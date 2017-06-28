import "babel-polyfill"
import "rxjs/add/operator/map"
import "rxjs/add/operator/do"
import "rxjs/add/operator/share"
import { Map } from 'immutable'
import { Subject } from 'rxjs/Subject'
import React from 'react'

const NO_OPPERATION = 'INTERNAL_NO_OPPERATION'


export const createStore = ({
  applyHandler,
  getState,
  setState,
}) => {
  const subs = []
  const store = (function * () {
    __loop: while (1) {
      const event = yield null
      const { type } = event
      if (type === 'INTERNAL_NO_OPPERATION') continue __loop
      const state = setState(applyHandler(getState(), event))
      for (let fn of subs) fn(state)
    }
  })()

  const dispatch = (type, ...payload) => {
    const event = { type, payload }
    store.next(event)
    store.next({ type:NO_OPPERATION })
    return event
  }

  // prime generator by yielding initial null
  dispatch(NO_OPPERATION)

  const subscribe = fn => {
    subs.push(fn)
    var subscribed = true
    return () => {
      if (subscribed) subs.splice(subs.indexOf(fn), 1)
      subscribed = false
    }
  }

  return {
    dispatch,
    subscribe,
  }
}



export const createHandlers = () => {
  var handlers = new Map()

  const identity = state => state
  const normalize = handler =>
    handler == null
      ? identity
      : handler

  const setHandler = (type, handler) => {
    handler = normalize(handler)
    handlers = handlers.set(type, handler)
    return handler
  }

  const getHandler = type =>
    handlers.get(type, identity)

  const applyHandler = (state, { type, payload }) =>
    getHandler(type)(state, ...payload)

  return {
    setHandler,
    getHandler,
    applyHandler,
  }
}



export const createIntents = ({
  dispatch,
}) => {
  var intents = new Map()

  const normalize = (type, intent) =>
    intent == null
      ? (...payload) => dispatch(type, ...payload)
      : intent

  const getIntent = type =>
    intents.get(String(type), normalize(type))

  const setIntent = (type, intent) => {
    intents = intents.set(String(type), normalize(type, intent))
    return getIntent(type)
  }

  return {
    setIntent,
    getIntent,
  }
}



export const createBus = () => {
  const bus$ = new Subject()

  const dispatch = (type, ...payload) => {
    const event = { type, payload }
    bus$.next(event)
    return event
  }

  return {
    bus$,
    dispatch,
  }
}



export const createState = ({
  initialState,
}) => {
  var state = initialState || new Map()

  const setState = nextState => {
    state = nextState || state
    return state
  }

  const getState = (cursor, fallback) =>
    cursor == null
      ? state
      : state.getIn(cursor, fallback)

  return {
    setState,
    getState,
  }
}



export const createConnect = ({
  subscribe,
  getState,
}) => {
  const calcKey = (props, key) =>
    key == null ? undefined : props[key]

  const defaultMapProps = () => ({})

  const connect = (mapProps = defaultMapProps) => (Comp, key) => {
    class Connected extends React.Component {
      constructor (props) {
        super(props)
        this.state = { hash: getState().hashCode() }
      }

      componentDidMount () {
        this.mount = true
        this.unsub = subscribe(state =>
          this.mount && this.setState({
            hash:state.hashCode()
          }))
      }

      componentWillUnmount () {
        this.mount = false
        this.unsub()
      }

      render () {
        var props = this.props
        return <Comp {...props} {...mapProps(getState, props) }/>
      }
    }

    return props =>
      <Connected key={calcKey(props, key)} {...props}/>
  }

  return {
    connect,
  }
}



export default initialState => {
  const { setState, getState } = createState({ initialState })
  const { applyHandler, setHandler } = createHandlers()
  const { dispatch, subscribe } = createStore({ applyHandler, getState, setState })
  const { setIntent, getIntent } =  createIntents({ dispatch })
  const { connect } = createConnect({ subscribe, getState })

  return {
    dispatch,
    getState,
    handle: setHandler,
    handler: setHandler,
    intent: setIntent,
    intents: getIntent,
    $: getIntent,
    connect,
  }
}
