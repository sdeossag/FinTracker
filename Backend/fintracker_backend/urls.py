# URLs principales de FinTracker
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('api/health/', health),
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/', include('core.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]