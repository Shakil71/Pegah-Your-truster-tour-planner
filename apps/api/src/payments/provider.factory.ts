import { Logger, type Provider } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PAYMENT_PROVIDER, type PaymentProvider } from "./provider";
import { SimulatorProvider } from "./simulator.provider";
import { SslcommerzProvider } from "./sslcommerz.provider";

/** Chooses the payment adapter from configuration; null means payments are off. */
export function createPaymentProvider(config: AppConfig): PaymentProvider | null {
  const logger = new Logger("Payments");
  switch (config.PAYMENT_PROVIDER) {
    case "sslcommerz":
      logger.log(`SSLCOMMERZ enabled (${config.SSLCOMMERZ_MODE})`);
      return new SslcommerzProvider({
        storeId: config.SSLCOMMERZ_STORE_ID!,
        storePassword: config.SSLCOMMERZ_STORE_PASSWORD!,
        mode: config.SSLCOMMERZ_MODE,
        productProfile: config.SSLCOMMERZ_PRODUCT_PROFILE,
      });
    case "simulator":
      logger.warn("Payment SIMULATOR enabled — development/testing only");
      return new SimulatorProvider(config.PUBLIC_BASE_URL!.replace(/\/$/, ""));
    default:
      return null;
  }
}

export const paymentProvider: Provider = {
  provide: PAYMENT_PROVIDER,
  inject: [APP_CONFIG],
  useFactory: createPaymentProvider,
};
