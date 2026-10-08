import { BadRequestException } from "@nestjs/common";
import {
  lateSessionRequestHash,
  lateSessionTimes,
} from "./late-session-request.helper";
import { RecordLateSessionDto } from "./record-late-session.dto";
const dto = {
  scheduledAt: "2026-09-01T10:00:00Z",
  durationMins: 60,
  status: "COMPLETED",
} as RecordLateSessionDto;
describe("late session timestamp parsing at internal boundaries", () => {
  it.each(["scheduledAt", "receivedAt", "cancelledAt", "noShowAt"])(
    "rejects invalid %s before hashing instead of raising RangeError",
    (field) => {
      expect(() =>
        lateSessionRequestHash({ ...dto, [field]: "2026-W05-1T10:00:00Z" }),
      ).toThrow(BadRequestException);
    },
  );
  it.each([
    { scheduledAt: "not-a-date" },
    { durationMins: NaN },
    { durationMins: Infinity },
  ])("rejects nonfinite internal command %j", (fields) => {
    expect(() =>
      lateSessionTimes({ ...dto, ...fields }, new Date("2026-10-05")),
    ).toThrow(BadRequestException);
  });
  it("rejects nonfinite internal clock", () => {
    expect(() => lateSessionTimes(dto, new Date(NaN))).toThrow(
      BadRequestException,
    );
  });
});
