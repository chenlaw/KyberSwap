import React from "react"
import { connect } from "react-redux"
import { openPromoCodeModal } from "../../actions/accountActions"
import { getTranslate } from 'react-localize-redux'

@connect((store) => {
  return {
    translate: getTranslate(store.locale),
    analytics: store.global.analytics,
  }
})
export default class ImportByPromoCode extends React.Component {
  openModal() {
    this.props.dispatch(openPromoCodeModal());
    this.props.analytics.callTrack("trackClickImportAccount", "promo code");
  }

  render() {
    return (
      <div>
        {!this.props.isOnMobile && (
          <div className="import-account__block" onClick={this.openModal.bind(this)}>
            <div className="import-account__icon promo-code"></div>
            <div className="import-account__name">{this.props.translate("landing_page.promo_code") || "PROMO CODE"}</div>
          </div>
        )}

        {this.props.isOnMobile && (
          <div className={"import-account__block"}>
            <div className={"import-account__block-left"}>
              <div className="import-account__icon promo-code"/>
              <div>
                <div className="import-account__name">{this.props.translate("landing_page.promo_code") || "PROMO CODE"}</div>
                <div className="import-account__desc">Access your Wallet</div>
              </div>
            </div>
            <div className="import-account__block-right" onClick={this.openModal.bind(this)}>Enter</div>
          </div>
        )}
      </div>
    )
  }
}
