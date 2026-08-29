-- House Care v1.0.3 — per-placement layout label preferences.
-- Safe to run once on an existing v1.0.2 database.

alter table public.layout_elements
  add column if not exists label_font_size numeric not null default 19,
  add column if not exists label_wrap boolean not null default false,
  add column if not exists label_width numeric;

alter table public.layout_elements drop constraint if exists layout_elements_label_font_size_check;
alter table public.layout_elements add constraint layout_elements_label_font_size_check
  check (label_font_size between 10 and 48);

alter table public.layout_elements drop constraint if exists layout_elements_label_width_check;
alter table public.layout_elements add constraint layout_elements_label_width_check
  check (label_width is null or label_width between 40 and 1000);

comment on column public.layout_elements.label_font_size is 'Per-placement label size in layout viewBox units/pixels.';
comment on column public.layout_elements.label_wrap is 'Whether the placement label may wrap across multiple lines.';
comment on column public.layout_elements.label_width is 'Optional explicit wrapping width. NULL follows the element width automatically.';
