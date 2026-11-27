-- Which blind-index normalization rules produced the stored `*_bidx` values
-- (docs/decisions/0008-blind-index.md, decision 5). NULL means "unknown": stores
-- written before this migration used interim rules, so the repository rebuilds
-- every index on open and then records its own version here. The column holds
-- no member data; the settings row itself is written by the repository.
ALTER TABLE settings ADD COLUMN blind_index_rules_version integer;
