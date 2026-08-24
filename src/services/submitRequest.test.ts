import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidRequestInput } from "@/domain/errors";
import type { DeadlineRequest } from "@/domain/request";
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
    AUTO_APPROVE_MAX_DAYS: 3,
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
  requester: { slackUserId: "U123", displayName: "Manager" },
  supplier: "Meridian Supply",
  event: "RFP-2041",
  extensionDays: 5,
  reason: "their plant lost power",
  reading: { confidence: 0.95, rationale: "Stated plainly.", model: "fake" },
};

function stubRequest(overrides: Partial<DeadlineRequest> = {}): DeadlineRequest {
  return {
    id: "req-1",
    reference: "DD-1001",
    requester: VALID.requester,
    supplier: "Meridian Supply",
    event: "RFP-2041",
    extensionDays: 5,
    reason: "their plant lost power",
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

  it("sends an extension above the limit to the sourcing lead", async () => {
    const { request, routing } = await submitRequest(VALID);

    expect(routing.route).toBe("lead");
    expect(request.status).toBe("pending_lead");
    expect(mocks.updateStatus).toHaveBeenCalledWith("req-1", "pending_lead", "sourcing_lead", {});
  });

  it("approves an extension within the limit without an approver", async () => {
    mocks.insertRequest.mockResolvedValue(stubRequest({ extensionDays: 2 }));

    const { request, routing } = await submitRequest({ ...VALID, extensionDays: 2 });

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

  it.each([
    ["zero days", { extensionDays: 0 }],
    ["more than a year", { extensionDays: 366 }],
    ["a fraction of a day", { extensionDays: 1.5 }],
    ["an empty supplier", { supplier: "" }],
    ["an empty event", { event: "" }],
    ["a missing requester id", { requester: { slackUserId: "", displayName: "Manager" } }],
  ])("rejects %s", async (_label, overrides) => {
    await expect(submitRequest({ ...VALID, ...overrides })).rejects.toThrow(InvalidRequestInput);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("names the offending field without echoing its value", async () => {
    const secretSupplier = "Very Confidential Supplier Ltd";
    await expect(
      submitRequest({ ...VALID, supplier: secretSupplier, extensionDays: 0 }),
    ).rejects.toThrow(/extensionDays/);
    await expect(
      submitRequest({ ...VALID, supplier: secretSupplier, extensionDays: 0 }),
    ).rejects.not.toThrow(new RegExp(secretSupplier));
  });
});
