const POPUP_NAME = 'viam-radio-popup'
const POPUP_FEATURES =
  'popup=yes,width=420,height=640,left=120,top=60,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no'

let popupRef: Window | null = null

export function isRadioPopupOpen(): boolean {
  return popupRef !== null && !popupRef.closed
}

export function openRadioPopup(): Window | null {
  if (typeof window === 'undefined') return null

  if (isRadioPopupOpen()) {
    popupRef?.focus()
    return popupRef
  }

  popupRef = window.open(`${window.location.origin}/radio`, POPUP_NAME, POPUP_FEATURES)
  return popupRef
}

export function focusRadioPopup(): boolean {
  if (!isRadioPopupOpen()) return false
  popupRef?.focus()
  return true
}
