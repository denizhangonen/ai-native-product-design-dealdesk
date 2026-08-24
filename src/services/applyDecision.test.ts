import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidTransition, RequestNotFound } from "@/domain/errors";
import type { DeadlineRequest } from "@/domain/request";
import type { RequestStatus } from "@/domain/status";
import { applyDecision } from "@/services/applyDecision";

const mocks = vi.hoisted(() => ({
  getRequestForUpdate: vi.fn(),
  updateStatus: vi.fn(),
  appendEvent: vi.fn(),
  begin: vi.fn(),
}));

vi.mock("@/data/db", () => ({ db: () => ({ begin: mocks.begin }) }));
vi.mock("@/data/requests", () => ({
  getRequestForUpdate: mocks.getRequestForUpdate,
  updateStatus: mocks.updateStatus,
}));
vi.mock("@/data/events", () => ({ appendEvent: mocks.appendEvent }));

function stubRequest(status: RequestStatus): DeadlineRequest {
  return {
    id: "req-1",
    reference: "DD-1001",
    requester: { slackUserId: "U123", displayName: "Rep" },
    supplier: "Meridian Supply",
    event: "RFP-2041",
    extensionDays: 5,
    reason: null,
    status,
    approverRole: "sourcing_lead",
    reading: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.begin.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({}),
  );
  mocks.updateStatus.mockImplementation(async (_id: string, status: RequestStatus) =>
    stubRequest(status),
  );
  mocks.appendEvent.mockResolvedValue(undefined);
});

describe("applyDecision", () => {
  it("reads the row under a lock inside the transaction, not before it", async () => {
    mocks.getRequestForUpdate.mockResolvedValue(stubRequest("pending_lead"));

    await applyDecision({
      requestId: "req-1",
      decision: "approve",
      actor: "lead@example.com",
    });

    // The executor passed to the read is the transaction, which is what holds the lock.
    expect(mocks.getRequestForUpdate).toHaveBeenCalledWith("req-1", {});
    expect(mocks.begin).toHaveBeenCalledTimes(1);
  });

  it("approves a request that is waiting on the sourcing lead", async () => {
    mocks.getRequestForUpdate.mockResolvedValue(stubRequest("pending_lead"));

    const result = await applyDecision({
      requestId: "req-1",
      decision: "approve",
      actor: "lead@example.com",
    });

    expect(result.request.status).toBe("approved");
    expect(result.changed).toBe(true);
    expect(mocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "lead_approved",
        actor: "lead@example.com",
      }),
      {},
    );
  });

  it("rejects a request that is waiting on the sourcing lead", async () => {
    mocks.getRequestForUpdate.mockResolvedValue(stubRequest("pending_lead"));

    const result = await applyDecision({
      requestId: "req-1",
      decision: "reject",
      actor: "lead@example.com",
      note: "2 days is the most we can give",
    });

    expect(result.request.status).toBe("rejected");
    expect(result.changed).toBe(true);
    expect(mocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { note: "2 days is the most we can give" },
      }),
      {},
    );
  });

  it("ignores the same decision arriving twice", async () => {
    mocks.getRequestForUpdate.mockResolvedValue(stubRequest("approved"));

    const result = await applyDecision({
      requestId: "req-1",
      decision: "approve",
      actor: "lead@example.com",
    });

    expect(result.request.status).toBe("approved");
    expect(result.changed).toBe(false);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(mocks.appendEvent).not.toHaveBeenCalled();
  });

  it("refuses to reverse a decision that was already made", async () => {
    mocks.getRequestForUpdate.mockResolvedValue(stubRequest("approved"));

    await expect(
      applyDecision({
        requestId: "req-1",
        decision: "reject",
        actor: "lead@example.com",
      }),
    ).rejects.toThrow(InvalidTransition);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it("refuses a decision on a request that was never routed to the sourcing lead", async () => {
    mocks.getRequestForUpdate.mockResolvedValue(stubRequest("pending_review"));

    await expect(
      applyDecision({
        requestId: "req-1",
        decision: "approve",
        actor: "lead@example.com",
      }),
    ).rejects.toThrow(InvalidTransition);
  });

  it("reports an unknown request", async () => {
    mocks.getRequestForUpdate.mockResolvedValue(null);

    await expect(
      applyDecision({
        requestId: "missing",
        decision: "approve",
        actor: "lead@example.com",
      }),
    ).rejects.toThrow(RequestNotFound);
  });
});
