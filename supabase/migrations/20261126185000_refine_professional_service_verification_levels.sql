-- Refine verification tiers so non-regulated knowledge work does not require a formal certificate by default.
-- The exact evidence checklist is maintained in the application/admin UI and rollout documentation.
update public.professional_service_subcategories
set verification_level = case id
  when 'interpreter-travel' then 'reference'
  when 'business-consultant' then 'reference'
  when 'private-tutor' then 'reference'
  when 'language-translator' then 'reference'
  else verification_level
end,
updated_at = now()
where id in ('interpreter-travel','business-consultant','private-tutor','language-translator');

comment on column public.professional_service_subcategories.verification_level is
  'Minimum review tier: identity, reference, credential, or license. Profession-specific evidence checklist is maintained by the application; tier alone is not proof of qualification.';
