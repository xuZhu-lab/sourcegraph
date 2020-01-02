import React, { useCallback, useEffect } from 'react'
import combyJsonSchema from '../../../../../../schema/campaign-types/comby.schema.json'
import credentialsJsonSchema from '../../../../../../schema/campaign-types/credentials.schema.json'
import { ThemeProps } from '../../../../../../shared/src/theme'
import { MonacoSettingsEditor } from '../../../../settings/MonacoSettingsEditor'
import { CampaignType } from '../backend.js'

export const MANUAL_CAMPAIGN_TYPE = 'manual' as const

/**
 * Data represented in {@link CampaignPlanSpecificationFields}.
 */
export interface CampaignPlanSpecificationFormData {
    /** The campaign plan specification type (e.g., "comby"). */
    type: CampaignType | typeof MANUAL_CAMPAIGN_TYPE

    /** The campaign plan specification arguments (as JSONC). */
    arguments: string
}

interface Props extends ThemeProps {
    value: CampaignPlanSpecificationFormData
    onChange: (newValue: CampaignPlanSpecificationFormData) => void

    readOnly?: boolean
    className?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonSchemaByType: { [K in CampaignType]: any } = {
    comby: combyJsonSchema,
    credentials: credentialsJsonSchema,
}

const typeLabels: Record<CampaignType | typeof MANUAL_CAMPAIGN_TYPE, string> = {
    [MANUAL_CAMPAIGN_TYPE]: 'Manual',
    comby: 'Comby search and replace',
    credentials: 'Find leaked credentials',
}

const defaultInputByType: { [K in CampaignType]: string } = {
    comby: `{
    "scopeQuery": "repo:github.com/foo/bar",
    "matchTemplate": "",
    "rewriteTemplate": ""
}`,
    credentials: `{
    "scopeQuery": "repo:github.com/foo/bar",
    "matchers": [{ "type": "npm" }]
}`,
}

export const DEFAULT_CAMPAIGN_PLAN_SPECIFICATION_FORM_DATA: CampaignPlanSpecificationFormData = {
    type: 'comby',
    arguments: defaultInputByType.comby,
}

/**
 * Fields for selecting the type and arguments for the campaign plan specification.
 */
export const CampaignPlanSpecificationFields: React.FunctionComponent<Props> = ({
    value,
    onChange,
    readOnly,
    className,
    isLightTheme,
}) => {
    const onTypeChange = useCallback(
        (type: CampaignType | typeof MANUAL_CAMPAIGN_TYPE): void => {
            onChange({ type, arguments: type === MANUAL_CAMPAIGN_TYPE ? '' : defaultInputByType[type] })
        },
        [onChange]
    )
    const onArgumentsChange = useCallback((arguments_: string): void => onChange({ ...value, arguments: arguments_ }), [
        onChange,
        value,
    ])

    return (
        <div className={className}>
            <div className="flex-grow-1 form-group mb-0">
                {!readOnly ? (
                    <>
                        <label htmlFor="campaign-plan-specification-fields__type" className="font-weight-bold d-block">
                            Plan
                        </label>
                        <select
                            id="campaign-plan-specification-fields__type"
                            className="form-control w-auto d-inline-block e2e-campaign-type"
                            placeholder="Select campaign type"
                            onChange={e => onTypeChange(e.currentTarget.value as CampaignType)}
                            value={value.type}
                        >
                            {(Object.keys(typeLabels) as CampaignType[]).map(typeName => (
                                <option value={typeName || ''} key={typeName}>
                                    {typeLabels[typeName]}
                                </option>
                            ))}
                        </select>
                        {value.type === 'comby' ? (
                            <small className="ml-2">
                                <a rel="noopener noreferrer" target="_blank" href="https://comby.dev/#match-syntax">
                                    Learn about comby syntax
                                </a>
                            </small>
                        ) : value.type === MANUAL_CAMPAIGN_TYPE ? (
                            <small className="ml-2 text-muted">
                                You can add existing changesets on your code host to the campaign after creating it
                            </small>
                        ) : (
                            undefined
                        )}
                    </>
                ) : (
                    <p className="mb-0">{typeLabels[value.type || '']}</p>
                )}
            </div>
            {value.type !== MANUAL_CAMPAIGN_TYPE && (
                <MonacoSettingsEditor
                    className="flex-grow-1 mt-2 e2e-campaign-arguments"
                    isLightTheme={isLightTheme}
                    value={value.arguments}
                    jsonSchema={value.type ? jsonSchemaByType[value.type] : undefined}
                    height={110}
                    onChange={onArgumentsChange}
                    readOnly={readOnly}
                />
            )}
        </div>
    )
}
