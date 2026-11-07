-- Todo favor nuevo o editado queda pendiente de aprobación, sin importar su urgencia.
-- Este constraint de 0008 exigía que los favores normales estuvieran aprobados. Es segura de repetir.

ALTER TABLE public.favors DROP CONSTRAINT IF EXISTS chk_favors_normal_aprobado;
