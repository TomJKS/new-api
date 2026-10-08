/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'vitest'

import { SORT_OPTIONS } from '../constants'
import { sortModels } from '../lib/filters'
import type { PricingModel } from '../types'

function pricingModel(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'test-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

function dynamicModel(name: string, expr: string): PricingModel {
  return pricingModel({
    model_name: name,
    // The backend falls back to this placeholder ratio when no legacy ratio
    // is configured for an expression-priced model.
    model_ratio: 37.5,
    billing_mode: 'tiered_expr',
    billing_expr: expr,
  })
}

describe('sortModels price ordering', () => {
  test('sorts dynamic expression models by their displayed input price', () => {
    const models = [
      dynamicModel('expensive', 'tier("standard", p * 35 + c * 175)'),
      dynamicModel('cheap', 'tier("standard", p * 0.001 + c * 0.004)'),
      dynamicModel('middle', 'tier("standard", p * 0.7 + c * 3.5)'),
    ]
    expect(
      sortModels(models, SORT_OPTIONS.PRICE_LOW).map((m) => m.model_name)
    ).toEqual(['cheap', 'middle', 'expensive'])
    expect(
      sortModels(models, SORT_OPTIONS.PRICE_HIGH).map((m) => m.model_name)
    ).toEqual(['expensive', 'middle', 'cheap'])
  })

  test('keeps legacy ratio and dynamic expression prices on one scale', () => {
    // model_ratio * 2 = USD per 1M input tokens, so 1.25 is $2.5/1M.
    const legacy = pricingModel({ model_name: 'legacy', model_ratio: 1.25 })
    const dynamic = dynamicModel('dynamic', 'tier("standard", p * 0.7 + c * 3.5)')
    expect(
      sortModels([legacy, dynamic], SORT_OPTIONS.PRICE_LOW).map(
        (m) => m.model_name
      )
    ).toEqual(['dynamic', 'legacy'])
  })

  test('sorts fixed per-request models by model price', () => {
    const models = [
      pricingModel({
        model_name: 'per-call-high',
        quota_type: 1,
        model_price: 2,
      }),
      pricingModel({
        model_name: 'per-call-low',
        quota_type: 1,
        model_price: 0.01,
      }),
    ]
    expect(
      sortModels(models, SORT_OPTIONS.PRICE_LOW).map((m) => m.model_name)
    ).toEqual(['per-call-low', 'per-call-high'])
  })
})
