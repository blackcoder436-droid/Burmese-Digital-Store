# Expiry date policy — Myanmar Time (MMT)

## Decision (2026-06-06)
Expiry date display/update ကို Myanmar local day end (`23:59:59 MMT`) ဖြင့် သတ်မှတ်ရန် ဆုံးဖြတ်ပြီးပါပြီ။

## Implementation notes
- Server-side canonical timestamps: store as UTC (`ISO 8601` with `Z`).
- UI behavior: date-picker သည် MMT အရ date select/interpret လုပ်ပြီး, 저장 မလုပ်ခင် UTC timestamp သို့ convert ပြုလုပ်မည်။
- Admin date picker: selecting a date means `date 23:59:59 MMT` (convert to UTC for storage).
- Tests: conversions round-trip tested for typical Myanmar DST/offset assumptions (MMT = UTC+6:30).

## Acceptance
- UI shows expiry dates in MMT consistently for customers/admins.
- Saving an expiry stores an unambiguous UTC instant in DB.

## Notes
MMT offset: UTC+6:30. Ensure all server code uses timezone-aware conversions.
