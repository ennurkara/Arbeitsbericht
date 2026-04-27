import { calculateWorkHours, calculateBillableUnits } from '../utils'

describe('calculateWorkHours', () => {
  it('returns minute-precise hours for a full workday', () => {
    expect(calculateWorkHours('2026-04-20T08:00:00.000Z', '2026-04-20T17:30:00.000Z')).toBe(9.5)
  })

  it('returns 0 when end is before start', () => {
    expect(calculateWorkHours('2026-04-20T17:00:00.000Z', '2026-04-20T08:00:00.000Z')).toBe(0)
  })

  it('returns minute-precise hours for partial durations', () => {
    // 1h 6min → 66 min → 1.10 hours
    expect(calculateWorkHours('2026-04-20T09:00:00.000Z', '2026-04-20T10:06:00.000Z')).toBe(1.1)
    // 2h 1min → 121 min → 2.0166... → rounds to 2.02
    expect(calculateWorkHours('2026-04-20T07:12:00.000Z', '2026-04-20T09:13:00.000Z')).toBe(2.02)
  })
})

describe('calculateBillableUnits', () => {
  it('returns whole quarters for exact quarter-hour durations', () => {
    expect(calculateBillableUnits(0.25)).toBe(1)   // 15 min
    expect(calculateBillableUnits(2.5)).toBe(10)   // 150 min
    expect(calculateBillableUnits(2.75)).toBe(11)  // 165 min
    expect(calculateBillableUnits(9.5)).toBe(38)   // 570 min
  })

  it('does not bill the 9th unit when only 1–5 minutes are started (7:12–9:13/9:16/9:17)', () => {
    expect(calculateBillableUnits(121 / 60)).toBe(8) // 8 voll + 1 min
    expect(calculateBillableUnits(124 / 60)).toBe(8) // 8 voll + 4 min
    expect(calculateBillableUnits(125 / 60)).toBe(8) // 8 voll + 5 min — Schwelle
  })

  it('bills a 0.25 partial from the 6th minute on (7:12–9:18 → 8.25)', () => {
    expect(calculateBillableUnits(126 / 60)).toBe(8.25) // 8 voll + 6 min
    expect(calculateBillableUnits(130 / 60)).toBe(8.25) // 8 voll + 10 min
    expect(calculateBillableUnits(134 / 60)).toBe(8.25) // 8 voll + 14 min
  })

  it('jumps to the full quarter once 15 min are reached (7:12–9:27 → 9)', () => {
    expect(calculateBillableUnits(135 / 60)).toBe(9)    // 9 voll exakt
    expect(calculateBillableUnits(136 / 60)).toBe(9)    // 9 voll + 1 min
    expect(calculateBillableUnits(140 / 60)).toBe(9)    // 9 voll + 5 min
    expect(calculateBillableUnits(141 / 60)).toBe(9.25) // 9 voll + 6 min
  })

  it('returns 0 for the first 5 minutes of work and for guards', () => {
    expect(calculateBillableUnits(0)).toBe(0)
    expect(calculateBillableUnits(null)).toBe(0)
    expect(calculateBillableUnits(undefined)).toBe(0)
    expect(calculateBillableUnits(-1)).toBe(0)
    expect(calculateBillableUnits(NaN)).toBe(0)
    expect(calculateBillableUnits(5 / 60)).toBe(0)   // 5 min — Schwelle nicht erreicht
    expect(calculateBillableUnits(6 / 60)).toBe(0.25) // 6 min — Schwelle erreicht
  })
})
