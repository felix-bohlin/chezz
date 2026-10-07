// The people of Kumoi: forty-odd villagers, four refugees and one hermit. See sim/types.ts for how schedules work.

import { CAMP } from './folk-camp'
import { FARM } from './folk-farm'
import { HARBOUR } from './folk-harbour'
import { TEMPLE } from './folk-temple'
import { TOWN } from './folk-town'
import type { VillagerSpec } from './types'

export * from './types'

export const CAST: VillagerSpec[] = [...FARM, ...CAMP, ...TOWN, ...HARBOUR, ...TEMPLE]
