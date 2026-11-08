-- 0038: Evita el spam de alertas y avisa cuando un reporte se resuelve. Requiere la 0034. Segura de repetir.

-- 1. Máximo 3 reportes por vecino por hora: cada reporte avisa a toda la zona.
CREATE OR REPLACE FUNCTION public.fn_limitar_reportes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reporter_user_id IS NOT NULL AND (
       SELECT count(*) FROM public.vulnerability_reports r
        WHERE r.reporter_user_id = NEW.reporter_user_id AND r.created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Enviaste demasiados reportes seguidos; espera un poco antes de enviar otro' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_limitar_reportes ON public.vulnerability_reports;
CREATE TRIGGER trg_limitar_reportes
  BEFORE INSERT ON public.vulnerability_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_limitar_reportes();

-- 2. Al resolverlo una persona (no el vencimiento automático), avisa a quien reportó y a los voluntarios.
CREATE OR REPLACE FUNCTION public.fn_notificar_reporte_resuelto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT x.uid, 'reporte_actualizado',
         jsonb_build_object('report_id', NEW.id, 'resolved', true,
                            'resolved_by_name', (SELECT u.full_name FROM public.users u WHERE u.id = NEW.resolved_by_user_id))
    FROM (SELECT NEW.reporter_user_id AS uid
          UNION
          SELECT rr.user_id FROM public.report_responders rr WHERE rr.report_id = NEW.id) x
   WHERE x.uid IS NOT NULL AND x.uid <> NEW.resolved_by_user_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo avisar la resolución del reporte %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_reporte_resuelto ON public.vulnerability_reports;
CREATE TRIGGER trg_notificar_reporte_resuelto
  AFTER UPDATE OF status ON public.vulnerability_reports
  FOR EACH ROW
  WHEN (OLD.status = 'activo' AND NEW.status = 'resuelto' AND NEW.resolved_by_user_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_notificar_reporte_resuelto();
