import ExpoModulesCore
import PassKit

public class SawaaPaymentsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SawaaPayments")
    Function("canUseApplePay") { (networks: [String]) -> Bool in
      guard !networks.isEmpty else { return false }
      var supported: [PKPaymentNetwork] = []
      for network in networks {
        switch network {
        case "mada": supported.append(.mada)
        case "visa": supported.append(.visa)
        case "mastercard": supported.append(.masterCard)
        default: return false
        }
      }
      return PKPaymentAuthorizationController.canMakePayments(usingNetworks: supported)
    }
  }
}
