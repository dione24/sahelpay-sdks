"""
Exemple d'intégration SahelPay dans une application Django de réservation

Ce module montre comment intégrer SahelPay pour:
- Créer des paiements pour des réservations
- Gérer les webhooks
- Vérifier les statuts de paiement
"""

import json
import sahelpay
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404, redirect
from django.contrib.auth.decorators import login_required

# Initialiser le client SahelPay
sahelpay_client = sahelpay.Client(
    secret_key=settings.SAHELPAY_SECRET_KEY,
    environment=getattr(settings, 'SAHELPAY_ENVIRONMENT', 'production')
)


# =============================================================================
# MODÈLE DE RÉSERVATION (exemple)
# =============================================================================

"""
# models.py

from django.db import models
from django.contrib.auth.models import User

class Booking(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('confirmed', 'Confirmée'),
        ('cancelled', 'Annulée'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('paid', 'Payé'),
        ('failed', 'Échoué'),
        ('refunded', 'Remboursé'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    service = models.ForeignKey('Service', on_delete=models.CASCADE)
    date = models.DateField()
    time = models.TimeField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    payment_reference = models.CharField(max_length=100, blank=True, null=True)
    payment_provider = models.CharField(max_length=50, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Réservation #{self.id} - {self.user.username}"
"""


# =============================================================================
# VUES DE PAIEMENT
# =============================================================================

@login_required
@require_http_methods(["POST"])
def create_payment(request, booking_id):
    """
    Créer un paiement pour une réservation

    POST /bookings/<booking_id>/pay/
    {
        "provider": "ORANGE_MONEY",
        "phone": "+22370000000"
    }
    """
    from .models import Booking  # Import local pour éviter les imports circulaires

    booking = get_object_or_404(Booking, id=booking_id, user=request.user)

    # Vérifier que la réservation n'est pas déjà payée
    if booking.payment_status == 'paid':
        return JsonResponse({
            'success': False,
            'error': 'Cette réservation est déjà payée'
        }, status=400)

    # Récupérer les données du formulaire
    data = json.loads(request.body)
    provider = data.get('provider', 'ORANGE_MONEY')
    phone = data.get('phone')

    if not phone:
        return JsonResponse({
            'success': False,
            'error': 'Numéro de téléphone requis'
        }, status=400)

    try:
        # Créer le paiement via SahelPay
        payment = sahelpay_client.payments.create(
            amount=float(booking.amount),
            currency='XOF',
            provider=provider,
            customer_phone=phone,
            description=f"Réservation #{booking.id} - {booking.service.name}",
            metadata={
                'booking_id': str(booking.id),
                'user_id': str(booking.user.id),
                'service_id': str(booking.service.id),
            },
            callback_url=f"{settings.SITE_URL}/api/webhooks/sahelpay/",
            return_url=f"{settings.SITE_URL}/bookings/{booking.id}/confirmation/",
        )

        # Sauvegarder la référence de paiement
        booking.payment_reference = payment.reference_id
        booking.payment_provider = provider
        booking.save()

        return JsonResponse({
            'success': True,
            'payment': {
                'reference_id': payment.reference_id,
                'ussd_code': payment.ussd_code,
                'status': payment.status,
                'amount': payment.amount,
            }
        })

    except sahelpay.ValidationError as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

    except sahelpay.SahelPayError as e:
        return JsonResponse({
            'success': False,
            'error': 'Erreur lors de la création du paiement. Veuillez réessayer.'
        }, status=500)


@login_required
def check_payment_status(request, booking_id):
    """
    Vérifier le statut d'un paiement

    GET /bookings/<booking_id>/payment-status/
    """
    from .models import Booking

    booking = get_object_or_404(Booking, id=booking_id, user=request.user)

    if not booking.payment_reference:
        return JsonResponse({
            'success': False,
            'error': 'Aucun paiement initié pour cette réservation'
        }, status=400)

    try:
        result = sahelpay_client.payments.check_status(
            booking.payment_reference)

        # Mettre à jour le statut si changé
        if result['status'] == 'SUCCESS' and booking.payment_status != 'paid':
            booking.payment_status = 'paid'
            booking.status = 'confirmed'
            booking.save()

            # Envoyer un email de confirmation
            # send_booking_confirmation_email(booking)

        elif result['status'] == 'FAILED' and booking.payment_status != 'failed':
            booking.payment_status = 'failed'
            booking.save()

        return JsonResponse({
            'success': True,
            'status': result['status'],
            'booking_status': booking.status,
            'payment_status': booking.payment_status,
        })

    except sahelpay.SahelPayError as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# =============================================================================
# WEBHOOK
# =============================================================================

@csrf_exempt
@require_http_methods(["POST"])
def sahelpay_webhook(request):
    """
    Recevoir les notifications de paiement SahelPay

    POST /api/webhooks/sahelpay/
    """
    from .models import Booking

    payload = request.body.decode('utf-8')
    signature = request.headers.get('X-SahelPay-Signature', '')

    try:
        # Vérifier et parser l'événement
        event = sahelpay_client.webhooks.parse_event(
            payload,
            signature,
            settings.SAHELPAY_WEBHOOK_SECRET
        )

        payment = event.data

        # Récupérer la réservation via les metadata
        booking_id = payment.metadata.get(
            'booking_id') if payment.metadata else None

        if not booking_id:
            # Essayer de trouver par référence
            try:
                booking = Booking.objects.get(
                    payment_reference=payment.reference_id)
            except Booking.DoesNotExist:
                return JsonResponse({'error': 'Booking not found'}, status=404)
        else:
            booking = get_object_or_404(Booking, id=booking_id)

        # Traiter selon l'événement
        if event.event == 'payment.success':
            booking.payment_status = 'paid'
            booking.status = 'confirmed'
            booking.save()

            # Actions post-paiement
            # send_booking_confirmation_email(booking)
            # send_sms_confirmation(booking)
            # notify_service_provider(booking)

        elif event.event == 'payment.failed':
            booking.payment_status = 'failed'
            booking.save()

            # Notifier l'utilisateur
            # send_payment_failed_email(booking)

        elif event.event == 'payment.cancelled':
            booking.payment_status = 'failed'
            booking.save()

        return JsonResponse({'received': True})

    except sahelpay.SahelPayError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': 'Internal error'}, status=500)


# =============================================================================
# PAGE DE CONFIRMATION
# =============================================================================

@login_required
def booking_confirmation(request, booking_id):
    """
    Page de confirmation après paiement

    GET /bookings/<booking_id>/confirmation/
    """
    from .models import Booking

    booking = get_object_or_404(Booking, id=booking_id, user=request.user)

    # Vérifier le statut du paiement si en attente
    if booking.payment_status == 'pending' and booking.payment_reference:
        try:
            result = sahelpay_client.payments.check_status(
                booking.payment_reference)
            if result['status'] == 'SUCCESS':
                booking.payment_status = 'paid'
                booking.status = 'confirmed'
                booking.save()
        except:
            pass

    context = {
        'booking': booking,
        'is_paid': booking.payment_status == 'paid',
    }

    return render(request, 'bookings/confirmation.html', context)


# =============================================================================
# URLS (urls.py)
# =============================================================================

"""
from django.urls import path
from . import views

urlpatterns = [
    # Paiement
    path('bookings/<int:booking_id>/pay/', views.create_payment, name='create_payment'),
    path('bookings/<int:booking_id>/payment-status/', views.check_payment_status, name='payment_status'),
    path('bookings/<int:booking_id>/confirmation/', views.booking_confirmation, name='booking_confirmation'),
    
    # Webhook
    path('api/webhooks/sahelpay/', views.sahelpay_webhook, name='sahelpay_webhook'),
]
"""


# =============================================================================
# SETTINGS (settings.py)
# =============================================================================

"""
# SahelPay Configuration
SAHELPAY_SECRET_KEY = os.environ.get('SAHELPAY_SECRET_KEY', 'sk_test_xxx')
SAHELPAY_WEBHOOK_SECRET = os.environ.get('SAHELPAY_WEBHOOK_SECRET', 'whsec_xxx')
SAHELPAY_ENVIRONMENT = os.environ.get('SAHELPAY_ENVIRONMENT', 'sandbox')  # ou 'production'

SITE_URL = os.environ.get('SITE_URL', 'http://localhost:8000')
"""
