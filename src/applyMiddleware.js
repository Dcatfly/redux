import compose from './compose'

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 * 因为middleware可能是异步的，所以这应该是组合链中的第一个store enhancer？这句话不是很懂
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * 咱们通过redux-thunk来学习applyMiddleware的代码
 * redux-thunk的源代码如下：
 * function createThunkMiddleware(extraArgument) {
 *   return ({ dispatch, getState }) => next => action => {
 *     if (typeof action === 'function') {
 *       return action(dispatch, getState, extraArgument);
 *     }
 *     return next(action);
 *   };
 * }
 * const thunk = createThunkMiddleware();
 * thunk.withExtraArgument = createThunkMiddleware;
 * export default thunk;
 * 在项目中的用法如下：examples/async/src/index.js:14
 * const store = createStore(
 *  reducer,
 *  applyMiddleware(...[thunk])
 * )
 * 相当于enhancer传入的是applyMiddleware返回的函数，
 * 而由于createStore中如果存在enhancer的时候，会直接执行enhancer(createStore)(reducer, preloadedState)，所以这相当于直接启动了applyMiddleware返回函数的执行。
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args)
    let dispatch = () => {
      throw new Error(
        'Dispatching while constructing your middleware is not allowed. ' +
          'Other middleware would not be applied to this dispatch.'
      )
    }

    const middlewareAPI = {
      getState: store.getState,
      //dispatch是函数中的调用方法，由于闭包的原因，实际执行的dispatch应该是下面经过compose的dispatch。
      //上面的Error是为了防止middleware(middlewareAPI)时就执行了dispatch。
      dispatch: (...args) => dispatch(...args)
    }
    // 此处套入thunk，
    // middleware => middleware(middlewareAPI)得到的应该是next => action => fn{};
    const chain = middlewares.map(middleware => middleware(middlewareAPI))

    //这里有点绕。compose是函数式编程的思想，从右往左执行，并且最后一个函数获取到的参数是store.dispatch
    // 套入thunk可以发现next就是store.dispatch
    // 或者如果有多个middleware的话，next是thunk后面的middleware应用了dispatch之后返回的action => fn{}，也就是一个处理action的函数，也就是dispatch。
    // 综上所述，最后dispatch就成了第一个middleware所返回的action => fn{}; 所以当调用dispatch的时候，应该先进入到了第一个middleware，看他处不处理，如果不处理它调用next(action),这时候又走到了第二个middleware。以此类推，最终走到了真实的store.dispatch。
    dispatch = compose(...chain)(store.dispatch)

    return {
      ...store,
      dispatch
    }
  }
}
