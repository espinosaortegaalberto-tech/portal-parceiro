import { describe, expect, it } from 'vitest'
import { calcularComisionPartner, calcularComisionesPeriodo } from './calculoComisiones'

const configDefault = {
  base_escalon_1: 26,
  base_escalon_2: 28,
  base_escalon_3: 30,
  umbral_escalon_1: 5,
  umbral_escalon_2: 12,
  bonus_dd: 4,
  bonus_fe: 1,
  sva_tarifa_baja: 10,
  sva_tarifa_alta: 14,
  sva_umbral_pct: 10,
}

function venta({ dd = false, fe = false, sva = false } = {}) {
  return { debito_directo: dd, factura_electronica: fe, sva }
}

describe('calcularComisionPartner', () => {
  it('ejemplo de la sección 5: 8 contratos, 6 DD, 5 FE, 2 SVA => 365 €', () => {
    const ventasPartner = [
      venta({ dd: true, fe: true, sva: true }),
      venta({ dd: true, fe: true, sva: true }),
      venta({ dd: true, fe: true }),
      venta({ dd: true, fe: true }),
      venta({ dd: true, fe: true }),
      venta({ dd: true }),
      venta(),
      venta(),
    ]

    const resultado = calcularComisionPartner(ventasPartner, configDefault)

    expect(resultado.n_contratos).toBe(8)
    expect(resultado.escalon_aplicado).toBe(2)
    expect(resultado.base_aplicada).toBe(28)
    expect(resultado.n_dd).toBe(6)
    expect(resultado.n_fe).toBe(5)
    expect(resultado.n_sva).toBe(2)
    expect(resultado.pct_sva).toBeCloseTo(25)
    expect(resultado.tarifa_sva_aplicada).toBe(14)
    expect(resultado.total_comision).toBe(365)
  })

  it('escalón 1: hasta 5 contratos', () => {
    const ventasPartner = Array.from({ length: 5 }, () => venta())
    const resultado = calcularComisionPartner(ventasPartner, configDefault)
    expect(resultado.escalon_aplicado).toBe(1)
    expect(resultado.base_aplicada).toBe(26)
  })

  it('escalón 3: más de 12 contratos', () => {
    const ventasPartner = Array.from({ length: 13 }, () => venta())
    const resultado = calcularComisionPartner(ventasPartner, configDefault)
    expect(resultado.escalon_aplicado).toBe(3)
    expect(resultado.base_aplicada).toBe(30)
  })

  it('pct_sva exactamente en el umbral (10%) aplica la tarifa alta', () => {
    const ventasPartner = [
      venta({ sva: true }),
      ...Array.from({ length: 9 }, () => venta()),
    ]
    const resultado = calcularComisionPartner(ventasPartner, configDefault)
    expect(resultado.pct_sva).toBeCloseTo(10)
    expect(resultado.tarifa_sva_aplicada).toBe(14)
  })
})

describe('calcularComisionesPeriodo', () => {
  it('agrupa las ventas por partner', () => {
    const ventas = [
      { id_partner: 'P1', ...venta({ dd: true }) },
      { id_partner: 'P1', ...venta() },
      { id_partner: 'P2', ...venta({ sva: true }) },
    ]
    const resultado = calcularComisionesPeriodo(ventas, configDefault)
    expect(resultado).toHaveLength(2)
    const p1 = resultado.find((r) => r.id_partner === 'P1')
    const p2 = resultado.find((r) => r.id_partner === 'P2')
    expect(p1.n_contratos).toBe(2)
    expect(p2.n_contratos).toBe(1)
  })
})
