import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidRequestInput } from "@/domain/errors";
import type { DiscountRequest } from "@/domain/request";
import type { RequestStatus } from "@/domain/status";
import { type SubmitRequestInput, submitRequest } from "@/services/submitRequest";

const mocks = vi.hoisted(() => ({
  insertRequest: vi.fn(),
  updateStatus: vi.fn(),
  appendEvent: vi.fn(),
  begin: vi.fn(),
}));

vi.mock("@/config", () => ({
  getConfig: () => ({
    DATABASE_URL: "x",
    APPROVAL_THRESHOLD_PERCENT: 15,
    LLM_PROVIDER: "fake",
  }),
}));
vi.mock("@/data/db", () => ({ db: () => ({ begin: mocks.begin }) }));
vi.mock("@/data/requests", () => ({
  insertRequest: mocks.insertRequest,
  updateStatus: mocks.updateStatus,
}));
vi.mock("@/data/events", () => ({ appendEvent: mocks.appendEvent }));

const VALID: SubmitRequestInput = {
  requester: { slackUserId: "U123", displayName: "Rep" },
  customer: "Acme",
  amountCents: 4_800_000,
  currency: "usd",
  discountPercent: 20,
  reason: "renewal at risk",
  reading: { confidence: 0.95, rationale: "Stated plainly.", model: "fake" },
};

function stubRequest(overrides: Partial<DiscountRequest> = {}): DiscountRequest {
  return {
    id: "req-1",
    reference: "DD-1001",
    requester: VALID.requester,
    customer: "Acme",
    amountCents: 4_800_000,
    currency: "USD",
    discountPercent: 20,
    reason: "renewal at risk",
    status: "pending_review",
    approverRole: null,
    reading: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.begin.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({}),
  );
  mocks.insertRequest.mockResolvedValue(stubRequest());
  mocks.updateStatus.mockImplementation(async (id: string, status: RequestStatus) =>
    stubRequest({ status }),
  );
  mocks.appendEvent.mockResolvedValue(undefined);
});

describe("submitRequest", () => {
  it("stores how the model read the message", async () => {
    await submitRequest(VALID);

    expect(mocks.insertRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        reading: { confidence: 0.95, rationale: "Stated plainly.", model: "fake" },
      }),
      expect.anything(),
    );
  });

  it("accepts a request with no reading, so the flow does not depend on one", async () => {
    const withoutReading = { ...VALID };
    delete withoutReading.reading;

    await submitRequest(withoutReading);

    expect(mocks.insertRequest).toHaveBeenCalledWith(
      expect.objectContaining({ reading: null }),
      expect.anything(),
    );
  });

  it("sends a discount above the limit to finance", async () => {
    const { request, routing } = await submitRequest(VALID);

    expect(routing.route).toBe("finance");
    expect(request.status).toBe("pending_finance");
    expect(mocks.updateStatus).toHaveBeenCalledWith("req-1", "pending_finance", "finance", {});
  });

  it("approves a discount within the limit without an approver", async () => {
    mocks.insertRequest.mockResolvedValue(stubRequest({ discountPercent: 10 }));

    const { request, routing } = await submitRequest({
      ...VALID,
      discountPercent: 10,
    });

    expect(routing.route).toBe("auto");
    expect(request.status).toBe("approved");
    expect(mocks.updateStatus).toHaveBeenCalledWith("req-1", "approved", null, {});
  });

  it("records the creation and the routing in the audit trail", async () => {
    await submitRequest(VALID);

    const types = mocks.appendEvent.mock.calls.map(([event]) => event.type);
    expect(types).toEqual(["created", "submitted"]);
  });

  it("does all of its writes inside one transaction", async () => {
    await submitRequest(VALID);
    expect(mocks.begin).toHaveBeenCalledTimes(1);
  });

  it("normalises the currency to upper case", async () => {
    await submitRequest(VALID);
    expect(mocks.insertRequest).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "USD" }),
      {},
    );
  });

  it.each([
    ["a discount above 100", { discountPercent: 101 }],
    ["a negative amount", { amountCents: -1 }],
    ["a fractional amount in cents", { amountCents: 10.5 }],
    ["an empty customer", { customer: "" }],
    ["a bad currency", { currency: "dollars" }],
    ["a missing requester id", { requester: { slackUserId: "", displayName: "Rep" } }],
  ])("rejects %s", async (_label, overrides) => {
    await expect(submitRequest({ ...VALID, ...overrides })).rejects.toThrow(InvalidRequestInput);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("names the offending field without echoing its value", async () => {
    const secretCustomer = "Very Confidential Customer Ltd";
    await expect(
      submitRequest({
        ...VALID,
        customer: secretCustomer,
        discountPercent: 101,
      }),
    ).rejects.toThrow(/discountPercent/);
    await expect(
      submitRequest({
        ...VALID,
        customer: secretCustomer,
        discountPercent: 101,
      }),
    ).rejects.not.toThrow(new RegExp(secretCustomer));
  });
});
