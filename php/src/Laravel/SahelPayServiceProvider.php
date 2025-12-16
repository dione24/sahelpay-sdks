<?php

declare(strict_types=1);

namespace SahelPay\Laravel;

use Illuminate\Support\ServiceProvider;
use SahelPay\SahelPay;

class SahelPayServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__ . '/config/sahelpay.php',
            'sahelpay'
        );

        $this->app->singleton(SahelPay::class, function ($app) {
            $config = $app['config']['sahelpay'];
            
            return new SahelPay(
                $config['secret_key'],
                $config['public_key'],
                [
                    'webhook_secret' => $config['webhook_secret'] ?? null,
                    'sandbox' => $config['sandbox'] ?? false,
                    'timeout' => $config['timeout'] ?? 30,
                    'base_url' => $config['base_url'] ?? null,
                ]
            );
        });

        $this->app->alias(SahelPay::class, 'sahelpay');
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/config/sahelpay.php' => config_path('sahelpay.php'),
            ], 'sahelpay-config');
        }
    }

    /**
     * Get the services provided by the provider.
     */
    public function provides(): array
    {
        return [SahelPay::class, 'sahelpay'];
    }
}
