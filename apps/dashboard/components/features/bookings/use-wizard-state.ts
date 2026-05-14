import { useCallback, useState } from 'react'
import type { BookingFlowOrder } from '@/lib/api/organization-settings'

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export interface WizardState {
  step: WizardStep
  clientId: string | null
  clientName: string | null
  serviceId: string | null
  serviceName: string | null
  employeeId: string | null
  employeeName: string | null
  type: 'in_person' | 'online' | 'walk_in' | null
  durationOptionId: string | null
  durationLabel: string | null
  date: string | null        // ISO date YYYY-MM-DD
  startTime: string | null   // HH:MM
  payAtClinic: boolean
  chosenPath: 'service_first' | 'employee_first' | null
}

const INITIAL_STATE: WizardState = {
  step: 1,
  clientId: null,
  clientName: null,
  serviceId: null,
  serviceName: null,
  employeeId: null,
  employeeName: null,
  type: null,
  durationOptionId: null,
  durationLabel: null,
  date: null,
  startTime: null,
  payAtClinic: false,
  chosenPath: null,
}

export function useWizardState(flowOrder: BookingFlowOrder = 'service_first') {
  const [state, setState] = useState<WizardState>(INITIAL_STATE)

  // When flowOrder is "both", use chosenPath (fallback to service_first for step calc)
  const effectiveFlow: 'service_first' | 'employee_first' =
    flowOrder === 'both'
      ? (state.chosenPath ?? 'service_first')
      : flowOrder

  // Step 2 is service or employee depending on effectiveFlow
  const stepForService: WizardStep = effectiveFlow === 'service_first' ? 2 : 3
  const stepForEmployee: WizardStep = effectiveFlow === 'service_first' ? 3 : 2

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step }))
  }, [])

  const choosePath = useCallback(
    (path: 'service_first' | 'employee_first') => {
      setState((prev) => ({ ...prev, chosenPath: path, step: 2 }))
    },
    [],
  )

  const selectClient = useCallback(
    (clientId: string, clientName: string) => {
      setState((prev) => ({
        ...prev,
        clientId,
        clientName,
        serviceId: null,
        serviceName: null,
        employeeId: null,
        employeeName: null,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        chosenPath: null,
        step: 2,
      }))
    },
    [],
  )

  const selectService = useCallback(
    (serviceId: string, serviceName: string) => {
      setState((prev) => ({
        ...prev,
        serviceId,
        serviceName,
        employeeId: null,
        employeeName: null,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        step: (prev.step + 1) as WizardStep,
      }))
    },
    [],
  )

  const selectEmployee = useCallback(
    (employeeId: string, employeeName: string) => {
      setState((prev) => ({
        ...prev,
        employeeId,
        employeeName,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        step: (prev.step + 1) as WizardStep,
      }))
    },
    [],
  )

  const selectType = useCallback(
    (type: 'in_person' | 'online' | 'walk_in') => {
      setState((prev) => ({
        ...prev,
        type,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
      }))
    },
    [],
  )

  const selectDuration = useCallback(
    (durationOptionId: string, durationLabel: string) => {
      setState((prev) => ({
        ...prev,
        durationOptionId,
        durationLabel,
        date: null,
        startTime: null,
        step: 5,
      }))
    },
    [],
  )

  const skipDuration = useCallback(() => {
    setState((prev) => ({
      ...prev,
      durationOptionId: null,
      durationLabel: null,
      step: 5,
    }))
  }, [])

  const selectDate = useCallback((date: string) => {
    setState((prev) => ({
      ...prev,
      date,
      startTime: null,
    }))
  }, [])

  const selectTime = useCallback((startTime: string) => {
    setState((prev) => ({ ...prev, startTime, step: 6 }))
  }, [])

  const setPayAtClinic = useCallback((payAtClinic: boolean) => {
    setState((prev) => ({ ...prev, payAtClinic }))
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => {
      const nextStep = Math.max(1, prev.step - 1) as WizardStep
      const next: Partial<WizardState> = { step: nextStep }

      // In "both" mode, going back from the path-chosen step (3) should
      // go back to the path chooser (step 2, chosenPath = null)
      if (flowOrder === 'both' && prev.step === 3 && prev.chosenPath !== null) {
        next.step = 2
        next.chosenPath = null
        next.serviceId = null
        next.serviceName = null
        next.employeeId = null
        next.employeeName = null
        next.type = null
        next.durationOptionId = null
        next.durationLabel = null
        next.date = null
        next.startTime = null
        return { ...prev, ...next }
      }

      return { ...prev, ...next }
    })
  }, [flowOrder])

  const jumpToStep = useCallback(
    (targetStep: WizardStep) => {
      setState((prev) => {
        const next: WizardState = { ...prev, step: targetStep }

        // In "both" mode, jumping back to step 2 resets chosenPath
        if (flowOrder === 'both' && targetStep <= 2) {
          next.chosenPath = null
        }

        if (targetStep <= stepForService) {
          next.serviceId = null
          next.serviceName = null
          next.employeeId = null
          next.employeeName = null
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep <= stepForEmployee) {
          next.employeeId = null
          next.employeeName = null
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep === 4) {
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep === 5) {
          next.date = null
          next.startTime = null
        }
        return next
      })
    },
    [stepForService, stepForEmployee, flowOrder],
  )

  return {
    state,
    effectiveFlow,
    stepForService,
    stepForEmployee,
    reset,
    goToStep,
    goBack,
    jumpToStep,
    choosePath,
    selectClient,
    selectService,
    selectEmployee,
    selectType,
    selectDuration,
    skipDuration,
    selectDate,
    selectTime,
    setPayAtClinic,
  }
}
