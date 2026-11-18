import assert from "node:assert/strict";
import test from "node:test";

import {
  ETHIOPIAN_MONTHS,
  ethiopianToGregorian,
  formatEthiopianDateTimeInEAT,
  getEthiopianMonthDays,
  gregorianToEthiopian,
  isEthiopianLeapYear,
  toEastAfricaDateOnly,
} from "../ethiopianCalendar";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

function assertEth(actual: { year: number; month: number; day: number }, expected: { year: number; month: number; day: number }, msg: string) {
  assert.deepEqual(
    { year: actual.year, month: actual.month, day: actual.day },
    expected,
    msg
  );
}

test("Gregorian -> Ethiopian -> Gregorian round trips (intended UTC calendar day)", () => {
  const cases = [
    utcDate(2026, 9, 11),
    utcDate(2026, 9, 12),
    utcDate(2023, 9, 12), // Ethiopian New Year 2016 (Gregorian leap-year aftermath boundary)
    utcDate(2024, 9, 11),
    utcDate(2024, 2, 29), // Gregorian leap day
    utcDate(2020, 2, 29),
    utcDate(2025, 1, 1),
    utcDate(2024, 12, 31),
    utcDate(2026, 1, 1),
  ];

  for (const g of cases) {
    const eth = gregorianToEthiopian(g);
    const back = ethiopianToGregorian(eth);
    assert.equal(ymd(back), ymd(g), `round trip failed for ${ymd(g)} via ${JSON.stringify(eth)}`);
  }
});

test("Ethiopian -> Gregorian -> Ethiopian round trips (intended calendar day)", () => {
  const cases = [
    { year: 2019, month: 1, day: 1 },
    { year: 2016, month: 1, day: 1 },
    { year: 2015, month: 13, day: 6 }, // leap Pagume (EC year where (year+1)%4==0)
    { year: 2016, month: 13, day: 5 },
    { year: 2018, month: 12, day: 30 },
    { year: 2018, month: 6, day: 15 },
    { year: 2017, month: 1, day: 30 },
    { year: 2017, month: 2, day: 1 },
  ];

  for (const e of cases) {
    const g = ethiopianToGregorian(e);
    const back = gregorianToEthiopian(g);
    assertEth(back, e, `round trip failed for ${JSON.stringify(e)} via ${ymd(g)}`);
  }
});

test("Ethiopian New Year boundaries map to expected Gregorian days", () => {
  assert.equal(ymd(ethiopianToGregorian({ year: 2019, month: 1, day: 1 })), "2026-09-11");
  assert.equal(ymd(ethiopianToGregorian({ year: 2016, month: 1, day: 1 })), "2023-09-12");
  assert.equal(ymd(ethiopianToGregorian({ year: 2017, month: 1, day: 1 })), "2024-09-11");

  assertEth(gregorianToEthiopian(utcDate(2026, 9, 10)), { year: 2018, month: 13, day: 5 }, "day before 2019 New Year");
  assertEth(gregorianToEthiopian(utcDate(2026, 9, 11)), { year: 2019, month: 1, day: 1 }, "2019 New Year");
  assertEth(gregorianToEthiopian(utcDate(2023, 9, 11)), { year: 2015, month: 13, day: 6 }, "day before 2016 New Year (leap Pagume)");
  assertEth(gregorianToEthiopian(utcDate(2023, 9, 12)), { year: 2016, month: 1, day: 1 }, "2016 New Year");
});

test("Ethiopian month boundaries and Pagume boundaries are correct", () => {
  // Month 1 has 30 days
  assertEth(gregorianToEthiopian(ethiopianToGregorian({ year: 2019, month: 1, day: 30 })), { year: 2019, month: 1, day: 30 }, "Meskerem 30");
  const meskerem30G = ethiopianToGregorian({ year: 2019, month: 1, day: 30 });
  const tikimt1G = new Date(meskerem30G.getTime() + 86400000);
  assertEth(gregorianToEthiopian(tikimt1G), { year: 2019, month: 2, day: 1 }, "Meskerem 30 -> Tikimt 1");

  // Pagume / year boundary (non-leap EC year 2016 has 5 Pagume days)
  assert.equal(isEthiopianLeapYear(2015), true);
  assert.equal(isEthiopianLeapYear(2016), false);
  assert.equal(getEthiopianMonthDays(2015, 13), 6);
  assert.equal(getEthiopianMonthDays(2016, 13), 5);

  assert.equal(ymd(ethiopianToGregorian({ year: 2015, month: 13, day: 6 })), "2023-09-11");
  assert.equal(ymd(ethiopianToGregorian({ year: 2016, month: 1, day: 1 })), "2023-09-12");
  assert.equal(ymd(ethiopianToGregorian({ year: 2016, month: 13, day: 5 })), "2024-09-10");
  assert.equal(ymd(ethiopianToGregorian({ year: 2017, month: 1, day: 1 })), "2024-09-11");
});

test("Gregorian leap-day cases round-trip correctly", () => {
  for (const g of [utcDate(2020, 2, 29), utcDate(2024, 2, 29)]) {
    const eth = gregorianToEthiopian(g);
    const back = ethiopianToGregorian(eth);
    assert.equal(ymd(back), ymd(g), `leap day ${ymd(g)}`);
    // and remains the same intended day
    assertEth(gregorianToEthiopian(back), eth, `leap day stability ${ymd(g)}`);
  }
});

test("EAT midnight boundary affects intended EAT date-only values", () => {
  // 20:59:59Z is 23:59:59 in EAT (same Gregorian day)
  assert.equal(toEastAfricaDateOnly("2026-11-18T20:59:59.000Z"), "2026-11-18");
  // 21:00:00Z is 00:00:00 next day in EAT
  assert.equal(toEastAfricaDateOnly("2026-11-18T21:00:00.000Z"), "2026-11-19");
});

test("UTC timestamps whose EAT calendar day differs from UTC day convert to correct EAT Ethiopian date", () => {
  // 2026-11-18T21:30:00Z -> 2026-11-19 in EAT
  const instant = new Date("2026-11-18T21:30:00.000Z");
  const eatShifted = new Date(instant.getTime() + 3 * 60 * 60 * 1000);
  const ethByUtcDay = gregorianToEthiopian(instant);
  const ethByEatDay = gregorianToEthiopian(eatShifted);

  assertEth(ethByUtcDay, { year: 2019, month: 3, day: 9 }, "UTC day should be Hidar 9, 2019");
  assertEth(ethByEatDay, { year: 2019, month: 3, day: 10 }, "EAT day should be Hidar 10, 2019");
  assert.notDeepEqual(ethByUtcDay, ethByEatDay);
});

test("formatting consistency for appointment/reschedule instants uses stable EAT calendar day", () => {
  const iso = "2026-11-18T21:00:00.000Z"; // EAT midnight boundary -> Hidar 10, 2019 06:00 ማታ
  const formatted = formatEthiopianDateTimeInEAT(iso);
  assert.equal(formatted, "ኅዳር 10 ቀን 2019 ዓ.ም. — 06:00 ማታ");

  // Same instant always formats consistently
  assert.equal(formatEthiopianDateTimeInEAT(new Date(iso)), formatted);

  // Cross-check intended EAT day components via shifted conversion
  const shifted = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000);
  const eth = gregorianToEthiopian(shifted);
  assert.equal(`${ETHIOPIAN_MONTHS[eth.month - 1]} ${eth.day} ቀን ${eth.year} ዓ.ም.`, "ኅዳር 10 ቀን 2019 ዓ.ም.");
});
