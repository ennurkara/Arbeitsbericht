import { calculateWorkHours, calculateBillableUnits } from '../utils'

describe('calculateWorkHours', () => {
  it('returns minute-precise hours for a full workday', () => {
    expect(calculateWorkHours('2026-04-20T08:00:00.000Z', '2026-04-20T17:30:00.000Z')).toBe(9.5)
  })

  it('returns 0 when end is before start', () => {
    expect(calculateWorkHours('2026-04-20T17:00:00.000Z', '2026-04-20T08:00:00.000Z')).toBe(0)
  })

  it('returns minute-precise hours for partial durations', () => {
    expect(calculateWorkHours('2026-04-20T09:00:00.000Z', '2026-04-20T10:06:00.000Z')).toBe(1.1)
    expect(calculateWorkHours('2026-04-20T07:12:00.000Z', '2026-04-20T09:13:00.000Z')).toBe(2.02)
  })
})

describe('calculateBillableUnits', () => {
  // Helper: turn "X minutes worked" into the hours value our function expects.
  const m = (minutes: number) => minutes / 60

  it('bills 1 ZE the moment any work starts (no tolerance on the 1st quarter)', () => {
    expect(calculateBillableUnits(m(1))).toBe(1)
    expect(calculateBillableUnits(m(5))).toBe(1)
    expect(calculateBillableUnits(m(6))).toBe(1)
    expect(calculateBillableUnits(m(15))).toBe(1)
  })

  it('keeps 1 ZE while the 2nd quarter is in its 5-min tolerance window', () => {
    expect(calculateBillableUnits(m(16))).toBe(1)
    expect(calculateBillableUnits(m(20))).toBe(1)
  })

  it('bumps to 2 ZE from minute 21 (2nd quarter past tolerance)', () => {
    expect(calculateBillableUnits(m(21))).toBe(2)
    expect(calculateBillableUnits(m(30))).toBe(2)
    expect(calculateBillableUnits(m(35))).toBe(2)
  })

  it('bumps to 3 ZE from minute 36 (3rd quarter past tolerance)', () => {
    expect(calculateBillableUnits(m(36))).toBe(3)
    expect(calculateBillableUnits(m(50))).toBe(3)
  })

  it('reaches 4 ZE at minute 51 — one full hour worked needs 51 min', () => {
    expect(calculateBillableUnits(m(51))).toBe(4)
    expect(calculateBillableUnits(m(60))).toBe(4)
    expect(calculateBillableUnits(m(65))).toBe(4)
  })

  it('handles the 7:12–9:13 case from the field (121 min → 8 ZE)', () => {
    expect(calculateBillableUnits(m(121))).toBe(8)
    expect(calculateBillableUnits(m(125))).toBe(8)
  })

  it('jumps to 9 ZE at minute 126 (9th quarter past tolerance)', () => {
    expect(calculateBillableUnits(m(126))).toBe(9)
    expect(calculateBillableUnits(m(135))).toBe(9)
    expect(calculateBillableUnits(m(140))).toBe(9)
  })

  it('returns 0 only for zero / negative / non-finite input', () => {
    expect(calculateBillableUnits(0)).toBe(0)
    expect(calculateBillableUnits(null)).toBe(0)
    expect(calculateBillableUnits(undefined)).toBe(0)
    expect(calculateBillableUnits(-1)).toBe(0)
    expect(calculateBillableUnits(NaN)).toBe(0)
  })
})
