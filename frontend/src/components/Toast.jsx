import { useEffect, useState } from 'react'

let listeners = []

export function toast(message) {
  listeners.forEach((fn) => fn(message))
}

export default function Toast() {
  const [msg, setMsg] = useState('')
  const [show, setShow] = useState(false)

  useEffect(() => {
    let timer
    const onToast = (message) => {
      setMsg(message)
      setShow(true)
      clearTimeout(timer)
      timer = setTimeout(() => setShow(false), 2200)
    }
    listeners.push(onToast)
    return () => {
      listeners = listeners.filter((l) => l !== onToast)
      clearTimeout(timer)
    }
  }, [])

  return <div className={`toast${show ? ' show' : ''}`}>{msg}</div>
}
