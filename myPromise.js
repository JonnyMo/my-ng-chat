(function (window) {
	// 即： fullfilled （成功状态）
	const RESOLVED = 'resolved'
	// 即： rejected （失败状态）
	const REJECTED = 'rejected'
	// 初始pending状态
	const PENDING = 'pending'
	
	/**
	 * [Promise 构造函数]
	 * @param {[Function]} executor [执行器函数，executor会立即同步执行]
	 */
	function Promise(executor){
		var self = this;
		self.result = undefined
		self.status = PENDING 
		self.callbacks = [];

		/**
		 * [resolve 将Promise状态修改为resolved 即 成功状态，并设置成功的值]
		 * @param  {[anyType]} value [成功的值]
		 * @return {[Promise]} [一个给定了值的成功的Promise实例对象]
		 */
		function resolve(value){
			if (self.status !== PENDING){
				return;
			}
			// 存放onResolved 或 onRejected 回调函数执行的结果
			let data = null;
			self.result = value
			self.status = RESOLVED

			// 立刻异步执行回调函数
			if(self.callbacks.length > 0){
				setTimeout(() => {
					self.callbacks.forEach((callbackObj) => {
						data = callbackObj.onResolved(self.result)
					})
				})
			}
		}

		/**
		 * [reject 将promise状态修改为rejected 即 失败状态，并设置失败的理由]
		 * @param  {[]} reason [失败的理由]
		 * @return {[Promise]} [一个给定原因了的失败的Promise实例对象]
		 */
		function reject(reason) {
			if (self.status !== PENDING){
				return;
			}
			self.result = reason
			self.status = REJECTED
			// 立刻异步执行回调函数
			// 存放onResolved 或 onRejected 回调函数执行的结果
			let data = null;
			if(self.callbacks.length > 0){
				setTimeout(() => {
					self.callbacks.forEach((callbackObj) => {
						callbackObj.onRejected(self.result)
					})
				})
			}
		}

		// 万一 执行器函数报错了， 就要执行reject
		try{
			executor(resolve, reject)
		}catch(e){
			reject(e)
		}
	}

	/**
	 * [接收成功的值或失败的理由]
	 * @param  {[Function]} onResolved [状态变为成功时的回调函数]
	 * @param  {[Function]} onRejected [状态变为失败时的回调函数]
	 * @return {[Promise]} [返回一个新的Promise实例对象, 返回的promise实例对象的状态和值，跟onResolved或onRejected 执行后的返回值有关]
	 */
	Promise.prototype.then = function(onResolved, onRejected) {
		let self = this;

		return new Promise(function (resolve, reject) {
			let data = null;
			// 设置默认值，可以让后面promise实例 接收到 value
			if(typeof onResolved !== 'function'){
				onResolved = (value) => value;
			}
			// 设置默认值，可以让后面promise实例 接收到 reason 
			if(typeof onRejected !== 'function'){
				onRejected = (err) => {throw err};
			}

			// 每次回调函数执行完后，需要根据回调函数的执行结果来 决定then 返回的promise实例的状态和值
			function _handle(callbackFn){
				try{
					data = callbackFn(self.result)
					if(data instanceof Promise){
						data.then((value) =>{
							resolve(value)
						}, (reason) =>{
							reject(reason)
						})
					}else{
						resolve(data)
					}							
				}catch(e){
					reject(e)
				}
			}

			// 对于先绑定onResolved 和 onRejected 回调函数的情况，
			// 需要重新包装onResolved，并加上处理then返回的promise实例的 状态
			// 因为只有在这个then的函数里面 才能去改变 then返回的promise实例的状态和值
			if(self.status === PENDING){
				// 注意在这里来改变then 返回的Promise实例的状态
				self.callbacks.push({
					onResolved(){
						_handle(onResolved)
					}, onRejected(){
						_handle(onRejected)
					}
				})
			}else if(self.status === RESOLVED){
				setTimeout(()=>{
					_handle(onResolved)
				})
			}else{
				setTimeout(()=>{
					_handle(onRejected)
				})
			}	
		})

	}

	/**
	 * [catch 设置onRejected回调函数, 用于获取失败的原因]
	 * @param  {[Function]} onRejected [失败的回调函数]
	 * @return {[Promise]} [返回一个新的Promise实例对象，和then 方法的返回值逻辑一致]
	 */
	Promise.prototype.catch = function(onRejected) {
		return this.then(null, onRejected)
	};

	/**
	 * [all 获取多个Promise实例对象成功状态的值]
	 * @param  {[Array]} iterable [数组元素的类型可以是任意类型]
	 * @return {[Promise]}  [返回一个新的Promise实例对象，iterable中所有的promise都成功时，all返回的promise才成功]
	 *   注意 对于iterable数组中的非Promise实例对象，会被当做成功状态的promise实例来对待，值就是它自身
	 */
	Promise.all = function(iterable) {

		return new Promise((resolve, reject)=>{
			// 统计成功的次数
			let count = 0;	
			// 按照promise的顺序，存储每个promise 实例对应的值
			let values = new Array(iterable.length);

			iterable.forEach((obj, index) => {
				if(obj instanceof Promise){
					obj.then((value) => {
						// 保证成功的值都是按iterable 数组中的顺序来存放的
						values[index] = value;
						count++;
						// 如果成功的次数，刚好和 iterable 的长度一致，表示已经全部成功了
						if(count === iterable.length){
							resolve(values)
						}
					}, 
					(err) => {
						// 只要有一个失败，all返回的promise实例的状态就是失败
						reject(err)	
					})
				}else{
					// iterable 可能里面放的根本就不是Promise实例
					count++;
					values[index] = obj;
					if(count === iterable.length){
						resolve(values)
					}
				}
			})	
		})

	}

	/**
	 * [race 返回一个promise，状态由iterable中的任意一个子promise被成功或失败的promise状态决定 race返回的promise的状态和值]
	 * @param  {[Array]} iterable [存放Promise对象的一个数组]
	 * @return {[Promise]}          [返回一个新的promise对象]
	 */
	Promise.race = function (iterable) {
		return new Promise((resolve, reject) => {
			iterable.forEach((obj) => {
				if (obj instanceof Promise){
					obj.then(resolve, reject)
				}else {
					resolve(obj)
				}
			})		
		})
	}

	/**
	 * [resolve 语法糖 返回一个成功了的，给定值的promise实例对象]
	 * @param  {[anyType]} val [给返回的promise设置的值]
	 * @return {[Promise]}     [Promise 实例对象]
	 */
	Promise.resolve = function (val) {
		return new Promise((resolve, reject) => {
			resolve(val)
		});
	}

	/**
	 * [reject 语法糖 类似于Promise.resolve,只是这个用于设置失败状态]
	 * @param  {[type]} reason [失败的理由]
	 * @return {[type]}        [Promise 实例对象]
	 */
	Promise.reject = function (reason) {
		return new Promise((resolve, reject) => {
			reject(reason)
		});
	}

	// 挂载到window上
	window.Promise = Promise;
	//window.Promise = window.Promise || Promise;
})(window)