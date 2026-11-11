async function main(workbook: ExcelScript.Workbook) {
  const API = "https://control-doc.pages.dev";

  let lastExcelHash = "";
  let lastWebHash = "";

  for (let cycle = 0; cycle < 600; cycle++) {
    // 1. Leer estado actual del Excel en OneDrive
    const shAsistRead = workbook.getWorksheet("CONTROL ASISTENCIA");
    const usedAsist = shAsistRead ? shAsistRead.getUsedRange() : undefined;
    const asistVals: (string | number | boolean)[][] = usedAsist ? usedAsist.getValues() : [];
    const asistenciaExcel: AsistenciaItem[] = [];

    for (let r = 1; r < asistVals.length; r++) {
      const row = asistVals[r];
      const aulaCell = String(row[6] || "").trim().toUpperCase();
      const docCell = String(row[10] || "").trim().toUpperCase();
      const nrcCell = String(row[7] || "").trim();
      if (!aulaCell && !docCell && !nrcCell) continue;
      if (aulaCell === "AULA") continue;
      asistenciaExcel.push({
        id: "asist_imp_" + String(r),
        pisoPabellon: String(row[0] || ""),
        sede: String(row[1] || "Comas"),
        periodo: String(row[2] || "2026-2"),
        dia: String(row[3] || "").toUpperCase(),
        horaInicioProg: String(row[4] || ""),
        horaFinalProg: String(row[5] || ""),
        aula: aulaCell,
        nrc: nrcCell,
        listaCruzada: String(row[8] || ""),
        codigoDocente: String(row[9] || ""),
        docente: docCell,
        curso: String(row[11] || "").toUpperCase(),
        carrera: String(row[12] || ""),
        horaInicioReal: String(row[13] || ""),
        horaFinalReal: String(row[14] || ""),
        asistencia: String(row[15] || "PENDIENTE").toUpperCase() || "PENDIENTE",
        puntualidad: String(row[16] || "-") || "-",
        observacion: String(row[17] || "")
      });
    }

    const shManRead = workbook.getWorksheet("HOJA DE ASISTENCIA 2026-2");
    const usedMan = shManRead ? shManRead.getUsedRange() : undefined;
    const manVals: (string | number | boolean)[][] = usedMan ? usedMan.getValues() : [];
    const manualExcel: ManualItem[] = [];

    for (let r = 1; r < manVals.length; r++) {
      const row = manVals[r];
      const nHojaVal = String(row[0] || "").trim().toUpperCase();
      if (nHojaVal.indexOf("HOJA") >= 0) continue;
      const docVal = String(row[5] || "").trim().toUpperCase();
      const nrcVal = String(row[3] || "").trim();
      const reempVal = String(row[8] || "").trim().toUpperCase();
      if (!docVal && !nrcVal && !reempVal) continue;
      manualExcel.push({
        id: "manual_2_" + String(r),
        n_hoja: nHojaVal,
        fecha: String(row[1] || ""),
        aula: String(row[2] || "").toUpperCase(),
        nrc: nrcVal,
        codigo_docente: String(row[4] || ""),
        docente: docVal,
        curso: String(row[6] || "").toUpperCase(),
        observacion: String(row[7] || ""),
        docente_reemplazo: reempVal
      });
    }

    const currentExcelHash = JSON.stringify({ a: asistenciaExcel, m: manualExcel });
    if (!lastExcelHash) {
      lastExcelHash = currentExcelHash;
    } else if (currentExcelHash !== lastExcelHash && asistenciaExcel.length > 0) {
      await fetch(API + "/api/import-excel-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asistencia: asistenciaExcel,
          manualSheets: manualExcel,
          clearExisting: true
        })
      });
      lastExcelHash = currentExcelHash;
      console.log("Cambio en Excel enviado a la Web App");
    }

    // 2. Consultar cambios en la Web App (con espera en servidor de 2.5s)
    const waitUrl = cycle === 0 ? API + "/api/all-data" : API + "/api/all-data?wait=2500";
    const res = await fetch(waitUrl);
    const json: AllDataResponse = await res.json();

    if (json && json.success && json.data) {
      const webData = json.data;
      const currentWebHash = JSON.stringify(webData);

      if (currentWebHash !== lastWebHash) {
        const asistenciaWeb: AsistenciaItem[] = webData.asistencia || [];
        const ticketsWeb: TicketItem[] = webData.tickets || [];
        const manualWeb: ManualItem[] = webData.manualSheets || [];
        const reservasWeb: ReservaItem[] = webData.reservas || [];

        // Actualizar CONTROL ASISTENCIA
        if (shAsistRead && asistenciaWeb.length > 0 && asistVals.length > 1) {
          const byKey: Record<string, AsistenciaItem> = {};
          for (let i = 0; i < asistenciaWeb.length; i++) {
            const item = asistenciaWeb[i];
            const k =
              String(item.nrc || "").trim() +
              "_" +
              String(item.dia || "").trim().toUpperCase() +
              "_" +
              String(item.aula || "").trim().toUpperCase();
            byKey[k] = item;
          }
          for (let r = 1; r < asistVals.length; r++) {
            const nrcRow = String(asistVals[r][7] || "").trim();
            const diaRow = String(asistVals[r][3] || "").trim().toUpperCase();
            const aulaRow = String(asistVals[r][6] || "").trim().toUpperCase();
            const match = byKey[nrcRow + "_" + diaRow + "_" + aulaRow];
            if (match) {
              const iniReal = String(match.horaInicioReal || "");
              const finReal = String(match.horaFinalReal || "");
              const asistStr = match.asistencia === "PENDIENTE" ? "" : String(match.asistencia || "");
              const puntStr = match.puntualidad === "-" ? "" : String(match.puntualidad || "");
              const obsStr = String(match.observacion || "");
              if (
                String(asistVals[r][15] || "") !== asistStr ||
                String(asistVals[r][16] || "") !== puntStr ||
                String(asistVals[r][17] || "") !== obsStr
              ) {
                shAsistRead.getRangeByIndexes(r, 13, 1, 5).setValues([[iniReal, finReal, asistStr, puntStr, obsStr]]);
              }
            }
          }
        }

        // Actualizar ATENCIONES 2026-2
        const shAten = workbook.getWorksheet("ATENCIONES 2026-2");
        const rowsAten: (string | number | boolean)[][] = [];
        for (let i = 0; i < ticketsWeb.length; i++) {
          const t = ticketsWeb[i];
          if (String(t.periodo || "2026-2") === "2026-1") continue;
          rowsAten.push([
            String(t.periodo || "2026-2"),
            String(t.fecha || ""),
            String(t.dia || ""),
            String(t.horaReporte || ""),
            String(t.ambiente || ""),
            String(t.piso || ""),
            String(t.pabellon || ""),
            String(t.tipoSolicitud || "ASISTENCIA TECNICA"),
            String(t.estado || "ATENDIDO"),
            String(t.usuario || "DOCENTE"),
            String(t.descripcionSolucion || ""),
            String(t.responsable || "")
          ]);
        }
        if (shAten && rowsAten.length > 0) {
          shAten.getRangeByIndexes(1, 0, rowsAten.length, 12).setValues(rowsAten);
        }

        // Actualizar HOJA DE ASISTENCIA 2026-2
        const rowsMan: (string | number | boolean)[][] = [];
        for (let i = 0; i < manualWeb.length; i++) {
          const m = manualWeb[i];
          const mid = String(m.id || "");
          if (mid.indexOf("manual_1_") === 0) continue;
          rowsMan.push([
            String(m.n_hoja || "LN1-" + String(rowsMan.length + 1)),
            String(m.fecha || ""),
            String(m.aula || ""),
            String(m.nrc || ""),
            String(m.codigo_docente || ""),
            String(m.docente || ""),
            String(m.curso || ""),
            String(m.observacion || ""),
            String(m.docente_reemplazo || "")
          ]);
        }
        if (shManRead && rowsMan.length > 0) {
          shManRead.getRangeByIndexes(1, 0, rowsMan.length, 9).setValues(rowsMan);
        }

        // Actualizar RESERVAS
        const shRes = workbook.getWorksheet("RESERVAS");
        const rowsRes: (string | number | boolean)[][] = [];
        for (let i = 0; i < reservasWeb.length; i++) {
          const rv = reservasWeb[i];
          rowsRes.push([
            String(rv.responsable || ""),
            String(rv.fecha || ""),
            String(rv.dia || ""),
            String(rv.inicio || ""),
            String(rv.final || ""),
            String(rv.ambiente || ""),
            String(rv.piso_pabellon || ""),
            String(rv.motivo || ""),
            String(rv.soporte || "")
          ]);
        }
        if (shRes && rowsRes.length > 0) {
          shRes.getRangeByIndexes(1, 0, rowsRes.length, 9).setValues(rowsRes);
        }

        lastWebHash = currentWebHash;
        console.log("Excel de OneDrive actualizado desde la Web App");
      }
    }
  }
}

interface AsistenciaItem {
  id?: string;
  pisoPabellon?: string;
  sede?: string;
  periodo?: string;
  dia?: string;
  horaInicioProg?: string;
  horaFinalProg?: string;
  aula?: string;
  nrc?: string;
  listaCruzada?: string;
  codigoDocente?: string;
  docente?: string;
  curso?: string;
  carrera?: string;
  horaInicioReal?: string;
  horaFinalReal?: string;
  asistencia?: string;
  puntualidad?: string;
  observacion?: string;
}

interface TicketItem {
  periodo?: string;
  fecha?: string;
  dia?: string;
  horaReporte?: string;
  ambiente?: string;
  piso?: string;
  pabellon?: string;
  tipoSolicitud?: string;
  estado?: string;
  usuario?: string;
  descripcionSolucion?: string;
  responsable?: string;
}

interface ManualItem {
  id?: string;
  n_hoja?: string;
  fecha?: string;
  aula?: string;
  nrc?: string;
  codigo_docente?: string;
  docente?: string;
  curso?: string;
  observacion?: string;
  docente_reemplazo?: string;
}

interface ReservaItem {
  responsable?: string;
  fecha?: string;
  dia?: string;
  inicio?: string;
  final?: string;
  ambiente?: string;
  piso_pabellon?: string;
  motivo?: string;
  soporte?: string;
}

interface AllDataPayload {
  asistencia?: AsistenciaItem[];
  tickets?: TicketItem[];
  manualSheets?: ManualItem[];
  reservas?: ReservaItem[];
}

interface AllDataResponse {
  success?: boolean;
  data?: AllDataPayload;
}

