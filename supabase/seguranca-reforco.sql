-- ============================================================
-- Estilosas Fitness — reforço de segurança (opcional)
-- ------------------------------------------------------------
-- Restringe INSERT/UPDATE/DELETE do catálogo e do bucket de
-- imagens ao e-mail do administrador, em vez de "qualquer
-- conta autenticada".
--
-- ANTES DE RODAR (2 passos no dashboard do Supabase):
--   1. Authentication → Sign In / Providers → Email
--      → "Enable Sign Ups" = OFF  (impede que qualquer um
--        crie conta e vire "autenticado")
--   2. Edite a linha `admin_email` abaixo com o e-mail REAL
--      da conta de administrador.
--
-- O arquivo se recusa a rodar com o e-mail de exemplo.
-- Depois de rodar, o login do painel continua igual.
-- ============================================================

do $$
declare
    admin_email constant text := 'victo.e.sousa7@gmail.com'; -- <<< EDITE AQUI
begin
    if admin_email = 'victo.e.sousa7@gmail.com' then
        raise exception 'Edite admin_email neste arquivo com o e-mail do administrador antes de rodar.';
    end if;

    if not exists (select 1 from auth.users where email = admin_email) then
        raise exception 'Nenhuma conta encontrada para % . Faça o login uma vez no painel com esse e-mail antes de rodar este arquivo.', admin_email;
    end if;

    -- Catálogo: escrita só para o admin ----------------------
    drop policy if exists "catalogo: insercao autenticada" on public.products;
    create policy "catalogo: insercao admin" on public.products
        for insert to authenticated
        with check (auth.jwt() ->> 'email' = admin_email);

    drop policy if exists "catalogo: edicao autenticada" on public.products;
    create policy "catalogo: edicao admin" on public.products
        for update to authenticated
        using (auth.jwt() ->> 'email' = admin_email)
        with check (auth.jwt() ->> 'email' = admin_email);

    drop policy if exists "catalogo: remocao autenticada" on public.products;
    create policy "catalogo: remocao admin" on public.products
        for delete to authenticated
        using (auth.jwt() ->> 'email' = admin_email);

    -- Bucket de imagens: escrita só para o admin --------------
    drop policy if exists "produtos: upload autenticado" on storage.objects;
    create policy "produtos: upload admin" on storage.objects
        for insert to authenticated
        with check (
            bucket_id = 'produtos'
            and auth.jwt() ->> 'email' = admin_email
            and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
        );

    drop policy if exists "produtos: substituicao autenticada" on storage.objects;
    create policy "produtos: substituicao admin" on storage.objects
        for update to authenticated
        using (bucket_id = 'produtos' and auth.jwt() ->> 'email' = admin_email)
        with check (
            bucket_id = 'produtos'
            and auth.jwt() ->> 'email' = admin_email
            and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
        );

    drop policy if exists "produtos: remocao autenticada" on storage.objects;
    create policy "produtos: remocao admin" on storage.objects
        for delete to authenticated
        using (bucket_id = 'produtos' and auth.jwt() ->> 'email' = admin_email);

    raise notice 'Reforço aplicado: escrita restrita a % .', admin_email;
end $$;

-- Conferência: deve mostrar só políticas "admin" para escrita.
select policyname, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename = 'products')
   or (schemaname = 'storage' and tablename = 'objects' and policyname like 'produtos:%')
order by schemaname, policyname;
