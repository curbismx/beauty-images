
create table public.featured_images (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index featured_images_order_idx on public.featured_images (sort_order desc, created_at desc);
alter table public.featured_images enable row level security;

create policy "public read featured_images" on public.featured_images for select to anon, authenticated using (true);
create policy "auth write featured_images" on public.featured_images for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('featured-images', 'featured-images', true);

create policy "public read featured bucket" on storage.objects for select to anon, authenticated using (bucket_id = 'featured-images');
create policy "auth write featured bucket" on storage.objects for all to authenticated using (bucket_id = 'featured-images') with check (bucket_id = 'featured-images');
