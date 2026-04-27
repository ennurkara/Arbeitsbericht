import { calculateWorkHours, roundUpToQuarterHour } from '../utils'

describe('roundUpToQuarterHour', () => {
  it('keeps exact quarter-hour values unchanged', () => {
    expect(roundUpToQuarterHour(0.25)).toBe(0.25)
    expect(roundUpToQuarterHour(2.5)).toBe(2.5)
    expect(roundUpToQuarterHour(2.75)).toBe(2.75)
    expect(roundUpToQuarterHour(9.5)).toBe(9.5)
  })

  it('rounds partial quarter hours up to the next 0.25', () => {
    expect(roundUpToQuarterHour(2.10)).toBe(2.25)
    expect(roundUpToQuarterHour(2.67)).toBe(2.75)
    expect(roundUpToQuarterHour(1.1)).toBe(1.25)
  })

  it('rounds tiny non-zero values up to one quarter hour', () => {
    expect(roundUpToQuarterHour(0.05)).toBe(0.25)
    expect(roundUpToQuarterHour(0.01)).toBe(0.25)
  })

  it('returns 0 for zero, negative or non-finite input', () => {
    expect(roundUpToQuarterHour(0)).toBe(0)
    expect(roundUpToQuarterHour(-1)).toBe(0)
    expect(roundUpToQuarterHour(NaN)).toBe(0)
    expect(roundUpToQuarterHour(Infinity)).toBe(0)
  })
})

describe('calculateWorkHours', () => {
  it('returns exact quarter-hour values unchanged', () => {
    // 9h 30min — already a multiple of 15 min
    expect(calculateWorkHours('2026-04-20T08:00:00.000Z', '2026-04-20T17:30:00.000Z')).toBe(9.5)
  })

  it('returns 0 when end is before start', () => {
    expect(calculateWorkHours('2026-04-20T17:00:00.000Z', '2026-04-20T08:00:00.000Z')).toBe(0)
  })

  it('rounds partial durations up to the next quarter hour', () => {
    // 1h 6min → next quarter is 1h 15min = 1.25
    expect(calculateWorkHours('2026-04-20T09:00:00.000Z', '2026-04-20T10:06:00.000Z')).toBe(1.25)
    // 2h 40min → next quarter is 2h 45min = 2.75
    expect(calculateWorkHours('2026-04-20T09:00:00.000Z', '2026-04-20T11:40:00.000Z')).toBe(2.75)
  })

  it('rounds a single extra minute up to the next full quarter', () => {
    // 1h 1min → 1h 15min = 1.25
    expect(calculateWorkHours('2026-04-20T09:00:00.000Z', '2026-04-20T10:01:00.000Z')).toBe(1.25)
  })
})
