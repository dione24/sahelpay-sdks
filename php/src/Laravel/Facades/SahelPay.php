<?php

declare(strict_types=1);

namespace SahelPay\Laravel\Facades;

use Illuminate\Support\Facades\Facade;
use SahelPay\SahelPay as SahelPayClient;

/**
 * @method static \SahelPay\Resources\Payment payments()
 * @method static \SahelPay\Resources\PaymentLink paymentLinks()
 * @method static \SahelPay\Resources\Payout payouts()
 * @method static \SahelPay\Resources\Withdrawal withdrawals()
 * @method static \SahelPay\Resources\Transaction transactions()
 * @method static \SahelPay\Resources\Webhook webhooks()
 * @method static \SahelPay\Resources\Plan plans()
 * @method static \SahelPay\Resources\Subscription subscriptions()
 * @method static \SahelPay\Resources\Customer customers()
 * @method static \SahelPay\Resources\Portal portal()
 * @method static \SahelPay\Resources\Refund refunds()
 * @method static bool isSandbox()
 *
 * @see \SahelPay\SahelPay
 */
class SahelPay extends Facade
{
    /**
     * Get the registered name of the component.
     */
    protected static function getFacadeAccessor(): string
    {
        return SahelPayClient::class;
    }
}
