import { describe, expect, it } from 'vitest'

import {
  resolveStartResearchConnectorBindings,
  shouldRecommendStartResearchConnectorBinding,
} from '../startResearch'

describe('shouldRecommendStartResearchConnectorBinding', () => {
  it('does not recommend before the first connector fetch completes', () => {
    expect(
      shouldRecommendStartResearchConnectorBinding({
        open: true,
        availabilityResolved: false,
        availabilityLoading: false,
        availabilityError: null,
        connectorRecommendationHandled: false,
        availability: null,
      })
    ).toBe(false)
  })

  it('does not recommend when an enabled connector already has a delivery target', () => {
    expect(
      shouldRecommendStartResearchConnectorBinding({
        open: true,
        availabilityResolved: true,
        availabilityLoading: false,
        availabilityError: null,
        connectorRecommendationHandled: false,
        availability: {
          has_enabled_external_connector: true,
          has_bound_external_connector: true,
          should_recommend_binding: false,
          preferred_connector_name: 'qq',
          preferred_conversation_id: 'qq:direct:user-1',
          available_connectors: [
            {
              name: 'qq',
              enabled: true,
              connection_state: 'connected',
              binding_count: 1,
              target_count: 1,
              has_delivery_target: true,
            },
          ],
        },
      })
    ).toBe(false)
  })

  it('recommends only after the connector fetch completes and no enabled connector exists', () => {
    expect(
      shouldRecommendStartResearchConnectorBinding({
        open: true,
        availabilityResolved: true,
        availabilityLoading: false,
        availabilityError: null,
        connectorRecommendationHandled: false,
        availability: {
          has_enabled_external_connector: false,
          has_bound_external_connector: false,
          should_recommend_binding: true,
          preferred_connector_name: null,
          preferred_conversation_id: null,
          available_connectors: [],
        },
      })
    ).toBe(true)
  })
})

describe('resolveStartResearchConnectorBindings', () => {
  it('defaults to the first available connector target only', () => {
    expect(
      resolveStartResearchConnectorBindings([
        {
          name: 'qq',
          targets: [
            { conversationId: 'qq:direct:qq-a::user-a' },
            { conversationId: 'qq:direct:qq-b::user-b' },
          ],
        },
        {
          name: 'telegram',
          targets: [{ conversationId: 'telegram:direct:tg-1' }],
        },
      ])
    ).toEqual({
      qq: 'qq:direct:qq-a::user-a',
      telegram: null,
    })
  })

  it('preserves one valid existing selection and clears the rest', () => {
    expect(
      resolveStartResearchConnectorBindings(
        [
          {
            name: 'qq',
            targets: [
              { conversationId: 'qq:direct:qq-a::user-a' },
              { conversationId: 'qq:direct:qq-b::user-b' },
            ],
          },
          {
            name: 'telegram',
            targets: [{ conversationId: 'telegram:direct:tg-2' }],
          },
        ],
        {
          qq: 'qq:direct:qq-b::user-b',
          telegram: 'telegram:direct:tg-2',
        }
      )
    ).toEqual({
      qq: 'qq:direct:qq-b::user-b',
      telegram: null,
    })
  })

  it('falls back to the next available connector when the current one becomes invalid', () => {
    expect(
      resolveStartResearchConnectorBindings(
        [
          {
            name: 'qq',
            targets: [],
          },
          {
            name: 'telegram',
            targets: [{ conversationId: 'telegram:direct:tg-2' }],
          },
        ],
        {
          qq: 'qq:direct:qq-b::user-b',
        }
      )
    ).toEqual({
      qq: null,
      telegram: 'telegram:direct:tg-2',
    })
  })

  it('preserves an explicit local-only choice', () => {
    expect(
      resolveStartResearchConnectorBindings(
        [
          {
            name: 'qq',
            targets: [{ conversationId: 'qq:direct:qq-a::user-a' }],
          },
          {
            name: 'telegram',
            targets: [{ conversationId: 'telegram:direct:tg-2' }],
          },
        ],
        {
          qq: null,
          telegram: null,
        }
      )
    ).toEqual({
      qq: null,
      telegram: null,
    })
  })
})
