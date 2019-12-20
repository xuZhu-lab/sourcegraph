import * as H from 'history'
import React, { useCallback, useEffect } from 'react'
import { ActivationProps } from '../../../../shared/src/components/activation/Activation'
import { Form } from '../../components/Form'
import { submitSearch, QueryState } from '../helpers'
import { SearchButton } from './SearchButton'
import { PatternTypeProps } from '..'
import { MonacoQueryInput } from './MonacoQueryInput'
import { Subject } from 'rxjs'

interface Props extends ActivationProps, PatternTypeProps {
    location: H.Location
    history: H.History
    navbarSearchState: QueryState
    onChange: (newValue: QueryState) => void
}

/**
 * The search item in the navbar
 */
export class SearchNavbarItem extends React.PureComponent<Props> {

    private onFormSubmit = (e: React.FormEvent): void => {e.preventDefault()}

    private onSubmit = (): void => {
        const { history, navbarSearchState, patternType, activation } = this.props
        submitSearch(history, navbarSearchState.query, 'nav', patternType, activation)
    }

    public render(): React.ReactNode {
        return (
            <Form className="search search--navbar-item d-flex align-items-start flex-grow-1" onSubmit={this.onFormSubmit}>
                <MonacoQueryInput {...this.props} queryState={this.props.navbarSearchState} onSubmit={this.onSubmit}></MonacoQueryInput>
                <SearchButton />
            </Form>
        )
    }

}
