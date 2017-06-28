import createStore from './index'
import { Map } from 'immutable'

const snap = (msg, value) =>
  test(msg, () => expect(value).toMatchSnapshot())

describe('createStore', () => {
  const {
    handle,
    $,
    intent,
    getState,
    dispatch,
    subscribe,
    connect,
  } = createStore(new Map({
    count: 5,
  }))

  handle('inc_by', (state, delta = 1) => state.updateIn(['count'], count => count + delta))
  intent('inc', () => dispatch('inc_by'))
  intent('inc_10', () => dispatch('inc_by', 10))

  const inc = $('inc')
  const inc10 = $('inc_10')

  snap("initial state", getState(['count']))
  dispatch("inc_by")
  snap("after raw dispatch of inc_by", getState(['count']))
  inc()
  snap("after intent thunk inc", getState(['count']))
  inc10()
  snap('after intent thunk inc10', getState(['count']))

  const Counter = ({ count }) =>
    <div id="Counter">
      { count }
      <button id="inc" onClick={() => inc10()}>+</button>
    </div>

  const ConnectedCounter = connect((state) => ({
    count: state(['count'], 0)
  }))(Counter)

  const Comp = mount(<ConnectedCounter/>)
  snap('initial component', Comp)

  Comp.find('#inc').simulate('click')
  snap('after click of inc button', Comp)
})
