// Modelo de comisiones: ver CLAUDE.md y sección 5 del documento de especificación.
// Escalado retroactivo por nº de contratos + bonus DD/FE + bonus de nivel SVA.

export function calcularEscalon(nContratos, config) {
  if (nContratos <= config.umbral_escalon_1) {
    return { escalon: 1, base: Number(config.base_escalon_1) }
  }
  if (nContratos <= config.umbral_escalon_2) {
    return { escalon: 2, base: Number(config.base_escalon_2) }
  }
  return { escalon: 3, base: Number(config.base_escalon_3) }
}

// ventasPartner: array de ventas de un partner en un periodo (ya filtradas).
// config: fila de configuracion_comisiones (o su snapshot).
export function calcularComisionPartner(ventasPartner, config) {
  const nContratos = ventasPartner.length
  const { escalon, base } = calcularEscalon(nContratos, config)

  const nDd = ventasPartner.filter((v) => v.debito_directo).length
  const nFe = ventasPartner.filter((v) => v.factura_electronica).length
  const nSva = ventasPartner.filter((v) => v.sva).length

  const pctSva = nContratos === 0 ? 0 : (nSva / nContratos) * 100
  const tarifaSva =
    pctSva >= Number(config.sva_umbral_pct)
      ? Number(config.sva_tarifa_alta)
      : Number(config.sva_tarifa_baja)

  const totalBase = nContratos * base
  const totalBonusDd = nDd * Number(config.bonus_dd)
  const totalBonusFe = nFe * Number(config.bonus_fe)
  const totalBonusSva = tarifaSva * nContratos
  const totalComision = totalBase + totalBonusDd + totalBonusFe + totalBonusSva

  return {
    n_contratos: nContratos,
    escalon_aplicado: escalon,
    base_aplicada: base,
    n_dd: nDd,
    n_fe: nFe,
    n_sva: nSva,
    pct_sva: pctSva,
    tarifa_sva_aplicada: tarifaSva,
    total_base: totalBase,
    total_bonus_dd: totalBonusDd,
    total_bonus_fe: totalBonusFe,
    total_bonus_sva: totalBonusSva,
    total_comision: totalComision,
  }
}

// ventas: array de ventas de TODOS los partners en un periodo.
// Devuelve un array de { id_partner, ...desglose } agrupado por id_partner.
export function calcularComisionesPeriodo(ventas, config) {
  const porPartner = new Map()
  for (const venta of ventas) {
    const lista = porPartner.get(venta.id_partner) ?? []
    lista.push(venta)
    porPartner.set(venta.id_partner, lista)
  }

  return Array.from(porPartner.entries()).map(([idPartner, ventasPartner]) => ({
    id_partner: idPartner,
    ...calcularComisionPartner(ventasPartner, config),
  }))
}
