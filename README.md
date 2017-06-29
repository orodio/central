# `@orodio/central`

[![Build Status](https://travis-ci.org/orodio/gate.svg?branch=master)](https://travis-ci.org/orodio/central)

### Install

```
yarn add @orodio/central
```

### General terms

**intent** _future tense_
> A request from the user to do something or know about something.
* Only ever called from the view or from another intent.
* The primary way to interact with the api.
* The only thing that ever creates/dispatches an event.

**event** _past tense_
> Something that did happen.
* Will posibly trigger a change in the applications state.
* Can only be created by the dispatch function.

**handler** _current tense_
> Takes an event and the current state and gives us the new state.
* Can only be triggered by an event.
* Must return the new state.


### Usage

`createStore` is passed an `initialState` and returns the following functions.

```javascript
const initialState({
  counters:new Map({
    "counter_1": new $Counter({
      id: "counter_1",
      title: "foo",
      count: 0,
    })
  })
})
const { dispatch, getState, connect, handler, intent, $ } = createStore(initialState)
```
* `initialState` must be an `immutable Map` from ImmutableJS.

**dispatch** _dispatches events into the store_
```javascript
dispatch('counter_set', counterId, counter)
```
* Should only ever be called from inside of an `intent` (never directly from the view)

**handler** _registers how an event transforms the current state_
```javascript
handler('counter_set', (state, counterId, counter) => {
  return state.setIn(['counters', counterId], counter)
})
```
* Must return the next state
* creates a default `intent` with the same event name. ie: `counter_set`

**intent** _registers how an event is created_
```javascript
intent('counter_set', (counter) => {
  return dispatch('counter_set', counter.id, counter)
})

intent('counter_get', ({ id }) => {
  return getCounterFromApi({ id })
    .then(normalizeCounter)
    .then($('counter_set'))
})
```
* All async needs to happen in an intent
* the only place you should ever call dispatch is in an intent

**intent** and **$** _how you access the intents you registerd_
```javascript
const counter2 = new $Counter({
  id: 'counter_2',
  title: 'bar',
  count: 10,
})

$('counter_set')(newCounter)

const counter3 = new $Counter({
  id: 'counter_3',
  title: 'baz',
  count: 15,
})

const counterSet = $('counter_set')
counterSet(counter3)
```
* `$`/`intents` and `connect` should be the only parts of a store you call in your view.

**getState** _gets the current state_
```javascript
getState() // Map({ counters:Map({ "counter_1":$Counter({ id:..., title:..., count:... }) }) })
getState(['counters', 'counter_1', 'title']) // "foo"
getState(['counters', 'counter_1', 'doesnt_exist'], 'default value') // "default_value"
```
* Returns the current state (`Immutable Map`)
* If if passed arguments acts like `.getIn([cursor], defaultValue)`

**connect** _connects a react component to the store_
```javascript
const inc = $('counter_inc')

const Counter = ({ id, title, count }) =>
  <div>
    <strong>{ title }:</strong> { count }
    <button onClick={() => inc(id)}>+</button>
  </div>

const mapStateToProps = (getState, props) => {
  const { id } = props
  return {
    title: getState(['counters', id, 'title'], ""),
    count: getState(['counters', id, 'count'], 0),
  }
}

export default connect(mapStateToProps)(Counter)
```
* `getState` in `mapStateToProps` is an actual `getState` function like the one returned from `createStore`
* You want to do as little computation inside of `mapStateToProps` as possible

### Something to keep in mind

*`dispatch`, `intents` and the callback passed into `handler` are all variadic, for example:*

* Given a `dispatch` call like: `dispatch("event_name", a, b, c, d, e, f)`
* It will be handled by the `handler`: `handler("event_name", (currentState, a, b, c, d, e, f) => nextState)`
* Which creates a default intent that is equivalent to:
  ```javascript
  intent("event_name", (a, b, c, d, e, f) =>
       dispatch('event_name', a, b, c, d, e, f))
  ```
* Which can then be called with: `$('event_name')(a, b, c, d, e, f)`

**In the future the following will be equivalent (using the above as an example)**
> This is not the case right now.
```
  $('event_name')(a, b, c, d, e, f)
  $`event_name`(a, b, c, d, e, f)
  $.event_name(a, b, c, d, e, f)
```

### Example

```javascript
import createStore from '@orodio/central'
import { Map, Record } from 'immutable'

// Implementation detail
const $Counter = new Record({
  id:    null,
  title: "",
  count: 0,
})

// our stores initial state
const initialState = new Map({
  counters: new Map({
    "a": new $Counter({ id:"a", title:"foo", count:"10" }),
    "b": new $Counter({ id:"b", title:"bar", count:"15" }),
  }),
})

// the creation of our store
const {
  dispatch,
  getState,
  connect,
  handler,
  intent,
  $,
} = createStore(initialState)


// register how an "inc_by" event can transform the state
handler('inc_by', (state, id, delta = 1) =>
  state.updateIn(['counters', id, 'count'], count => count + delta))

// register our intents
// our above handler already created an `inc_by` intent under the hood
// but if it didnt the following would do the same thing.
// We could also overload the 'inc_by' intent here if we wanted to, as
// the 'inc_by' handler is only actually called if we dispatch an 'inc_by' event.
// we default the intent to do this as a convenience but its important to
// remember that there isnt always a one-to-one mapping of intents and handlers
// later we can access this intent with `$('inc_by')`
// or call it with `$('inc_by')("a", 10)` which would 'increment counter "a" by 10'
intent('inc_by')

// this intent is calling another intent
// it can be accessed by `$('inc')`
// and be called with `$('inc')("a")` which would 'increment counter "a" by 1'
intent('inc', (id) => $('inc_by')(id, 1))

// this is an intent dispatching a totally different event
// it could just as easily have been done the same way as our 'inc' intent above
// it can be accessed by `$('dec')`
// and be called with `$('dec')("a")` which would 'increment counter "a" by -1'
intent('dec', (id) => dispatch('inc', id, -1))

// if we had async stuff (like hitting an api) we would do it in an intent.
handler('counters_set', (state, counters=new Map()) => {
  return state.setIn(['counters'], counters)
})
intent('counters_get', () => {
  return getCountersFromApi() // conveniently returns the data structure our store uses :P
    .then(counters => dispatch('counters_set', counters))
})

handler('counter_set', (state, id, counter) => {
  return state.setIn(['counters', id], counter)
})
intent('counter_get', ({ id }) => {
  return getCounterFromApi({ id })
    .then(counter => new $Counter(counter))
    .then(counter => dispatch('counter_set', counter.id, counter))
})

// we will leverage the fact that our `counters_get` and `counter_get` intents return
// a promise later in our components to show a loading state

//
// In our Components we could do some things like this
//

const inc = id => () =>
  $('inc')(id)

const dec = id => () =>
  $('dec')(id)

// what does it look like?
export const Counter = ({
  id      = null,
  title   = '',
  count   = 0,
  total   = 0,
  loading = false,
  dec     = dec, // lets us mock dec for testing
  inc     = inc, // lets us mock inc for testing
}) => {
  if (loading) return <div>Loading...</div>
  return <div>
    <strong>{ title }:</strong>
    <span>{ count }/{ total }</span>
    <button onClick={dec(id)}>-</button>
    <button onClick={inc(id)}>+</button>
  </div>
}

// what is the current state of our component?
// do we need any additional data from the server?
export class XhrCounter extends React.Component {
  state = {
    loading: true
  }

  componentDidMount () {
    this.mount = true
    $('counter_get')(this.props)
      .then(() => this.mount && this.setState({ loading:false }))
  }

  componentWillUnmount () {
    this.mount = false
  }

  render () {
    const { loading } = this.state
    return <Counter {...this.props}/>
  }
}

export const mapStateToProps = (state, { id }) => ({
  title: state(['counters', id, 'title'], ''),
  count: state(['counters', id, 'count'], 0),
  total: state()
          .getIn(['counters'], new Map())
          .reduce((total, counter) => total + counter.count, 0),
})

export const mapPropsToKey = props =>
  props.id

// connect returns a component that can be used as a covariant functor in a map function.
// how do we get the data from our store?
export const ConnectedCounter =
  connect(mapStateToProps)(XhrCounter, mapPropsToKey) // mapPropsToKey is completely optional

export default ConnectedCounter

//
// Another Component
//

// what does it look like?
export const Counters = ({ counters = [], loading = false }) => {
  if (loading) return <div>Loading...</div>

  return <div>
    <h1>Counters</h1>
    <div>
      { !counters.length
          ? "No Counters"
          : counters.map(ConnectedCounter)
      }
    </div>
  </div>
}

// what is the current state of our component?
// do we need any additional data from the server?
export class XhrCounters extends React.Component({
  state = {
    loading: true,
  }

  componentDidMount () {
    this.mount = true
    $('counters_get')()
      .then(() => this.mount && this.setState({ loading:false }))
  }

  componentWillUnmount () {
    this.mount = false
  }

  render () {
    const { loading } = this.state
    const { counters=[] } = this.props

    return <Counters
      counters={ counters }
      loading={ loading }
    />
  }
})

// how do we get the data from our store?
export const ConnectedCounters = connect(state => ({
  counters: state(['counters'], new Map())
              .map(counter => ({ id:counter.id }))
              .toArray(),
}))(XhrCounters)

export default ConnectedCounters


// Render it! :tada:
ReactDOM.render(<ConnectedCounters/>, domNodeToRenderIn)
```

