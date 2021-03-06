import { take, put, call, fork, select, takeEvery, all, cancel } from 'redux-saga/effects'
import EthereumService from "../services/ethereum/ethereum"
import { setConnection } from "../actions/connectionActions"
import { setMaxGasPrice } from "../actions/exchangeActions"

import {initTokens} from "../actions/tokenActions"

import { delay } from 'redux-saga'
import { store } from "../store"
import constants from "../services/constants"
import * as globalActions from "../actions/globalActions"
import * as web3Package from "../services/web3"
import BLOCKCHAIN_INFO from "../../../env"
import * as converter from "../utils/converter"

import { getTranslate } from 'react-localize-redux'
import NotiService from "../services/noti_service/noti_service"

function filterTokens(tokens){
  var newTokens = {}
  var now = Math.round(new Date().getTime()/1000)
  tokens.map(val => {
    if (val.listing_time > now) return
    if(val.delist_time && val.delist_time <= now) return
    newTokens[val.symbol] = {...val}
  })
  return newTokens
}

//get list tokens
function getListTokens() {
  //var network = process.env.npm_config_chain  || 'ropsten'
  //in ropsten
  var now = Math.round(new Date().getTime()/1000)
  return new Promise((resolve, reject) => {
    //return list of object tokens
    fetch(BLOCKCHAIN_INFO.api_tokens, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
    }).then((response) => {
      return response.json()
    })
      .then((result) => {
        if (result.success) {
          //check listing time
          
          var tokens = filterTokens(result.data)          
          resolve(tokens)

          //resolve(result.data)
        } else {
          //rejected(new Error("Cannot get data"))
          //get from snapshot
          resolve(BLOCKCHAIN_INFO.tokens)
        }
      })
      .catch((err) => {
        console.log(err)
        resolve(BLOCKCHAIN_INFO.tokens)
      })
  })
}


export function* createNewConnection(action) {
  var tokens = yield call(getListTokens)

  yield put.resolve(initTokens(tokens))

  var translate = getTranslate(store.getState().locale)
  var connectionInstance = new EthereumService()
  yield put.resolve(setConnection(connectionInstance))
  connectionInstance.subcribe()

  // var state = store.getState()
  // var ethereum = action.payload.ethereum
  // var ethereum = state.connection.ethereum
  yield put.resolve(setMaxGasPrice(connectionInstance))



  var web3Service = web3Package.newWeb3Instance()

  if (web3Service === false) {
    yield put.resolve(globalActions.throwErrorMematamask(translate("error.metamask_not_installed") || "Metamask is not installed"))
  } else {
    //const web3Service = new Web3Service(web3)
    const watchMetamask = yield fork(watchMetamaskAccount, connectionInstance, web3Service)
  }


  var notiService = new NotiService({ type: "session" })
  yield put.resolve(globalActions.setNotiHandler(notiService))

  //  const watchConnectionTask = yield fork(watchToSwitchConnection, connectionInstance)

  //yield take('GLOBAL.CLEAR_SESSION')
  //yield cancel(watchConnectionTask)
}

function* watchMetamaskAccount(ethereum, web3Service) {
  console.log("metamask_account")
  console.log(web3Service)
  //check 
  var translate = getTranslate(store.getState().locale)
  while (true) {
    try {
      var state = store.getState()
      const account = state.account.account
      if (account === false){

      // if (state.router && state.router.location) {
      //   var pathname = state.router.location.pathname
      //   if (pathname === constants.BASE_HOST) {

          //test network id
          const currentId = yield call([web3Service, web3Service.getNetworkId])
          const networkId = BLOCKCHAIN_INFO.networkId
          if (parseInt(currentId, 10) !== networkId) {
            const currentName = converter.findNetworkName(parseInt(currentId, 10))
            const expectedName = converter.findNetworkName(networkId)
            yield put(globalActions.throwErrorMematamask(translate("error.network_not_match", {expectedName: expectedName, currentName: currentName}) || `Metamask should be on ${expectedName}. Currently on ${currentName}`))
            return
          }

          //test address
          try {
            const coinbase = yield call([web3Service, web3Service.getCoinbase])
            const balanceBig = yield call([ethereum, ethereum.call], "getBalanceAtLatestBlock", coinbase)
            const balance = converter.roundingNumber(converter.toEther(balanceBig))
            yield put(globalActions.updateMetamaskAccount(coinbase, balance))
          } catch (e) {
            console.log(e)
            yield put(globalActions.throwErrorMematamask(translate("error.cannot_connect_metamask") || `Cannot get metamask account. You probably did not login in Metamask`))
          }

        
      }
    } catch (e) {
      console.log(e)
      yield put(globalActions.throwErrorMematamask(e.message))
    }

    yield call(delay, 5000)
  }
}

function* watchToSwitchConnection(ethereum) {
  while (true) {
    try {
      yield call(delay, 10000)
      if (ethereum.currentLabel === "ws") {
        if (!ethereum.wsProvider.connection) {
          ethereum.setProvider(ethereum.httpProvider)
          ethereum.currentLabel = "http"
          ethereum.subcribe()
          yield put(setConnection(ethereum))
          // return
        }
      }

      if (ethereum.currentLabel === "http") {
        if (ethereum.wsProvider.reconnectTime > 10) {
          // yield put(clearIntervalConnection())
          return;
        }
        if (ethereum.wsProvider.connection) {
          ethereum.clearSubcription()
          ethereum.wsProvider.reconnectTime = 0

          ethereum.setProvider(ethereum.wsProvider)
          ethereum.currentLabel = "ws"
          ethereum.subcribe()
          yield put(setConnection(ethereum))
        } else {
          // increase reconnect time
          var reconnectTime = ethereum.wsProvider.reconnectTime
          ethereum.wsProvider = ethereum.getWebsocketProvider()
          ethereum.wsProvider.reconnectTime = reconnectTime + 1
          yield put(setConnection(ethereum))
        }
        // return
      }
    } catch (err) {
      console.log(err)
    }
  }
}




export function* watchConnection() {
  yield takeEvery("CONNECTION.CREATE_NEW_CONNECTION", createNewConnection)
}
