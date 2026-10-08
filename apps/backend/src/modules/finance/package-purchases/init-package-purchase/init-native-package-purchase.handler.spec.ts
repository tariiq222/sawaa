import { InitNativePackagePurchaseHandler } from './init-native-package-purchase.handler';
describe('native package wrapper',()=>{
  it('does not reserve a purchase when native configuration is unavailable',async()=>{
    const purchases={execute:jest.fn()};const config={getPaymentConfiguration:jest.fn().mockRejectedValue(new Error('disabled'))};
    await expect(new InitNativePackagePurchaseHandler(purchases as never,config as never).execute({clientId:'client',packageId:'package',branchId:'branch',idempotencyKey:'key'})).rejects.toThrow('disabled');
    expect(purchases.execute).not.toHaveBeenCalled();
  });
  it('passes an internal fingerprint rather than changing the public purchase DTO',async()=>{
    const purchases={execute:jest.fn().mockResolvedValue({purchaseId:'purchase'})};const config={getPaymentConfiguration:jest.fn().mockResolvedValue({publishableKey:'pk_test_valid',isLive:false,applePay:null})};
    const cmd={clientId:'client',packageId:'package',branchId:'branch',idempotencyKey:'key'};
    await new InitNativePackagePurchaseHandler(purchases as never,config as never).execute(cmd);
    expect(purchases.execute).toHaveBeenCalledWith(cmd,{mode:'NATIVE',fingerprint:expect.stringMatching(/^[a-f0-9]{64}$/)});
  });
});
