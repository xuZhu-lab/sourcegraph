import * as Monaco from 'monaco-editor'
import { escapeRegExp } from 'lodash'
import { FILTERS, getFilterDefinition } from './filters'
import { Sequence } from './parser'
import { Omit } from 'utility-types'
import { SearchSuggestion } from '../../graphql/schema'
import { Observable } from 'rxjs'
import { isDefined } from '../../util/types'

const FILTER_TYPE_COMPLETIONS: Omit<Monaco.languages.CompletionItem, 'range'>[] = FILTERS.flatMap(
    ({ aliases, description }) =>
        aliases.map(
            (label: string): Omit<Monaco.languages.CompletionItem, 'range'> => ({
                label,
                kind: Monaco.languages.CompletionItemKind.Keyword,
                detail: description,
                insertText: `${label}:`,
                filterText: label,
            })
        )
)

export async function getCompletionItems(
    { members }: Pick<Sequence, 'members'>,
    { column }: Pick<Monaco.Position, 'column'>,
    context: Monaco.languages.CompletionContext,
    fetchSuggestions: (query: string) => Observable<SearchSuggestion[]>
): Promise<Monaco.languages.CompletionList | null> {
    const tokenAtColumn = members.find(({ range }) => range.start + 2 <= column && range.end + 2 >= column)
    if (!tokenAtColumn || tokenAtColumn.token.type === 'whitespace') {
        return null
    }
    const { token, range } = tokenAtColumn
    if (token.type === 'literal') {
        // Offer autocompletion of filter values
        return {
            suggestions: FILTER_TYPE_COMPLETIONS.filter(({ label }) => label.startsWith(token.value)).map(
                (suggestion): Monaco.languages.CompletionItem => ({
                    ...suggestion,
                    range: {
                        startLineNumber: 0,
                        endLineNumber: 0,
                        startColumn: range.start + 1,
                        endColumn: range.end + 1,
                    },
                })
            ),
        }
    }
    if (token.type === 'filter') {
        const { filterValue } = token
        if (!filterValue) {
            return null
        }
        const completingValue = filterValue.range.start + 2 <= column
        if (!completingValue) {
            return null
        }
        const filterDefinition = getFilterDefinition(token.filterType.token.value)
        if (!filterDefinition) {
            return null
        }
        if (filterDefinition.suggestions) {
            const suggestions = await fetchSuggestions(
                filterValue.token.type === 'quoted' ? filterValue.token.quotedValue : filterValue.token.value
            ).toPromise()
            return {
                suggestions: suggestions
                    .filter(({ __typename }) => __typename === filterDefinition.suggestions)
                    .map((suggestion): Monaco.languages.CompletionItem | null => {
                        if (suggestion.__typename === 'Repository' || suggestion.__typename === 'File') {
                            console.log(suggestion.name)
                            return {
                                label: suggestion.name,
                                kind: Monaco.languages.CompletionItemKind.Text,
                                insertText: `^${escapeRegExp(suggestion.name)}$ `,
                                filterText: `${token.filterType.token.value}:${suggestion.name}`,
                                range: {
                                    startLineNumber: 0,
                                    endLineNumber: 0,
                                    startColumn: filterValue.range.start + 1,
                                    endColumn: filterValue.range.end + 1,
                                },
                            }
                        }
                        return null
                    })
                    .filter(isDefined),
            }
        }
        if (filterDefinition.discreteValues) {
            return {
                suggestions: filterDefinition.discreteValues.map(
                    (label): Monaco.languages.CompletionItem => ({
                        label,
                        kind: Monaco.languages.CompletionItemKind.Text,
                        insertText: `${label} `,
                        filterText: label,
                        range: {
                            startLineNumber: 0,
                            endLineNumber: 0,
                            startColumn: filterValue.range.start + 1,
                            endColumn: filterValue.range.end + 1,
                        },
                    })
                ),
            }
        }
    }
    return null
}
