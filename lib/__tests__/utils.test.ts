import { calculateWorkHours } from '../utils'

describe('calculateWorkHours', () => {
  it('returns correct hours for a full workday', () => {
    expect(calculateWorkHours('2026-04-20T08:00:00.000Z', '2026-04-20T17:30:00.000Z')).toBe(9.5)
  })

  it('returns 0 when end is before start', () => {
    expect(calculateWorkHours('2026-04-20T17:00:00.000Z', '2026-04-20T08:00:00.000Z')).toBe(0)
  })

  it('rounds to one decimal place', () => {
    expect(calculateWorkHours('2026-04-20T09:00:00.000Z', '2026-04-20T10:06:00.000Z')).toBe(1.1)
  })
})