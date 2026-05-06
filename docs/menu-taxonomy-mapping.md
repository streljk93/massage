# Massage Menu Taxonomy Mapping

This mapping is the canonical bridge between menu labels and internal slugs.
It is used for manual data cleanup, import scripts, and QA validation.

## Category Mapping (`menu -> ServiceCategory.slug`)

- `Neck / Neck & Shoulder / Neck + Decolette` -> `neck`
- `Back massage` -> `back`
- `Full body / Body massage` -> `body`
- `Legs / Foot + Legs` -> `legs`
- `Arms / Hand massage` -> `arms`
- `Face massage` -> `face`
- `Head / Scalp massage` -> `head`
- `Relax / Relaxing massage` -> `relaxing`
- `Sports massage` -> `sports`
- `Lymphatic drainage` -> `lymphatic`
- `Thai massage` -> `thai`
- `Hot stone` -> `hot-stone`
- `Anti-cellulite` -> `anti-cellulite`
- `Honey massage` -> `honey`
- `Foot reflexology` -> `feet-reflexology`
- `Pressotherapy` -> `pressotherapy`
- `Pregnancy / Prenatal massage` -> `pregnancy`
- `Aroma / Aromatherapy` -> `aroma`
- `Classic massage` -> `classic`
- `Spa programs / Rituals / Packages` -> `spa`

## Body Zone Mapping (`menu -> BodyZone.slug`)

- `Head / Scalp` -> `head`
- `Face` -> `face`
- `Neck` -> `neck`
- `Shoulders` -> `shoulders`
- `Arms` -> `arms`
- `Hands` -> `hands`
- `Chest` -> `chest`
- `Abdomen / Belly` -> `abdomen`
- `Back upper` -> `back-upper`
- `Back lower / Lumbar` -> `back-lower`
- `Glutes / Hips` -> `glutes`
- `Thighs` -> `thighs`
- `Knees` -> `knees`
- `Calves` -> `calves`
- `Feet` -> `feet`
- `Full body` -> `full-body`

## Notes

- `ServiceCategory` represents technique/business classification.
- `BodyZone` represents anatomy and is optional for a service.
- If anatomy does not apply to a service, `ServiceBodyZone` rows are absent.
- For MVP, body zones are enabled only for `MajorServiceCategory.slug = "massage"`.
