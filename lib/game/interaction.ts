import type { CardActionIntent, LegalAction } from './types';

export function actionCardIds(action: LegalAction) {
  return [...action.cardInstanceIds, ...action.modifierInstanceIds];
}

export function buildCardActionIntents(
  actions: LegalAction[],
): CardActionIntent[] {
  const sources = new Map<string, LegalAction[]>();
  for (const action of actions)
    for (const source of action.cardInstanceIds)
      sources.set(source, [...(sources.get(source) ?? []), action]);
  return [...sources.entries()].map(([sourceInstanceId, candidates]) => ({
    sourceInstanceId,
    candidateActionIds: candidates.map((action) => action.id),
    chainInstanceIds: [
      ...new Set(
        candidates
          .flatMap(actionCardIds)
          .filter((id) => id !== sourceInstanceId),
      ),
    ],
    targets: [
      ...new Map(
        candidates
          .filter((action) => action.target)
          .map((action) => [
            `${action.target!.player}-${action.target!.monster}`,
            action.target!,
          ]),
      ).values(),
    ],
  }));
}

export function filterActionSelection(
  actions: LegalAction[],
  selected: string[],
) {
  const partial = selected.length
    ? actions.filter((action) =>
        selected.every((id) => actionCardIds(action).includes(id)),
      )
    : [];
  const exact = partial.filter((action) => {
    const ids = actionCardIds(action);
    return (
      ids.length === selected.length && ids.every((id) => selected.includes(id))
    );
  });
  const chainOptions = [
    ...new Set(
      partial.flatMap(actionCardIds).filter((id) => !selected.includes(id)),
    ),
  ];
  return { partial, exact, chainOptions };
}
