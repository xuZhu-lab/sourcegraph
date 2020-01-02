import React, { useState } from 'react'
import { isEqual } from 'lodash'
import * as GQL from '../../../../../../shared/src/graphql/schema'
import { NewCampaignFormData, NewCampaignForm, isExistingPlanID } from './NewCampaignForm'
import {
    DEFAULT_CAMPAIGN_PLAN_SPECIFICATION_FORM_DATA,
    MANUAL_CAMPAIGN_TYPE,
} from '../form/CampaignPlanSpecificationFields'
import { PageTitle } from '../../../../components/PageTitle'
import { Link } from '../../../../../../shared/src/components/Link'
import { Form } from '../../../../components/Form'
import { parseJSONCOrError } from '../../../../../../shared/src/util/jsonc'

interface Props {}

export const NewCampaignFormPage: React.FunctionComponent<Props> = () => {
    const planID: GQL.ID | null = new URLSearchParams(location.search).get('plan')

    const [value, setValue] = useState<NewCampaignFormData>({
        name: '',
        description: '',
        plan: planID || DEFAULT_CAMPAIGN_PLAN_SPECIFICATION_FORM_DATA,
    })

    const allowPreview = Boolean(
        !isExistingPlanID(value.plan) && value.plan.type !== MANUAL_CAMPAIGN_TYPE
    )


    return (
        <>
            <PageTitle title="New campaign" />
            <nav className="mb-2" aria-label="breadcrumb">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                        <Link to="/campaigns" className="text-decoration-none">
                            Campaigns
                        </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                        New
                    </li>
                </ol>
            </nav>
            <Form onSubmit={onSubmit} onReset={onCancel} className="e2e-campaign-form">
                <NewCampaignForm
                    value={value}
                    onChange={setValue}
                    allowPreview={allowPreview}
                    previewRefreshNeeded={true /* TODO!(sqs) */}
                    isLoadingPreview={false /* TODO!(sqs) */x}
                    // eslint-disable-next-line react/jsx-no-bind
                    onPreviewClick={() => nextPreviewCampaignPlan(formData.plan)}
                    disabled={mode === 'saving'}
                    isLightTheme={isLightTheme}
                />
            </Form>
        </>
    )
}
