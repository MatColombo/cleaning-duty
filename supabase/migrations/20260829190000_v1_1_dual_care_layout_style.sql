-- House Care v1.1.0 — dual routine/deep care and layout presentation preferences.
-- Safe to run once on an existing v1.0.3 database.

alter table public.routines
  add column if not exists care_level text not null default 'routine';

alter table public.routines drop constraint if exists routines_care_level_check;
alter table public.routines add constraint routines_care_level_check
  check (care_level in ('routine', 'deep'));

alter table public.task_occurrences
  add column if not exists care_level text not null default 'routine';

alter table public.task_occurrences drop constraint if exists task_occurrences_care_level_check;
alter table public.task_occurrences add constraint task_occurrences_care_level_check
  check (care_level in ('routine', 'deep'));

-- Existing routines/tasks are intentionally classified as routine cleaning.
update public.routines set care_level = 'routine' where care_level is null;
update public.task_occurrences set care_level = 'routine' where care_level is null;

alter table public.layout_scenes
  add column if not exists background_color text not null default '#f8f9f6';

alter table public.layout_elements
  add column if not exists label_rotation numeric not null default 0,
  add column if not exists fill_color text,
  add column if not exists text_color text,
  add column if not exists text_background_color text;

alter table public.layout_elements drop constraint if exists layout_elements_label_position_check;
alter table public.layout_elements add constraint layout_elements_label_position_check
  check (label_position in ('center', 'top', 'bottom'));

alter table public.layout_elements drop constraint if exists layout_elements_label_rotation_check;
alter table public.layout_elements add constraint layout_elements_label_rotation_check
  check (label_rotation between -180 and 180);

alter table public.layout_scenes drop constraint if exists layout_scenes_background_color_check;
alter table public.layout_scenes add constraint layout_scenes_background_color_check
  check (background_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.layout_elements drop constraint if exists layout_elements_fill_color_check;
alter table public.layout_elements add constraint layout_elements_fill_color_check
  check (fill_color is null or fill_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.layout_elements drop constraint if exists layout_elements_text_color_check;
alter table public.layout_elements add constraint layout_elements_text_color_check
  check (text_color is null or text_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.layout_elements drop constraint if exists layout_elements_text_background_color_check;
alter table public.layout_elements add constraint layout_elements_text_background_color_check
  check (text_background_color is null or text_background_color ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.routines.care_level is 'routine = short-term upkeep; deep = long-term/deep care.';
comment on column public.task_occurrences.care_level is 'Snapshot of routine care level at task generation time.';
comment on column public.layout_scenes.background_color is 'Visual canvas background color.';
comment on column public.layout_elements.fill_color is 'Optional room/item fill color; UI derives a darker contour.';
comment on column public.layout_elements.label_rotation is 'Per-placement label rotation in degrees.';
