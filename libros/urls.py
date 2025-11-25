from django.urls import path
from . import views

app_name = 'libros'

urlpatterns = [
    path('', views.index, name='index'),
    path('add-by-isbn/', views.add_by_isbn, name='add_by_isbn'),
    path('add-manual/', views.add_manual, name='add_manual'),
    path('books/', views.list_books, name='list_books'),
    path('export-excel/', views.export_excel, name='export_excel'),
    path('books/delete/<int:pk>/', views.delete_book, name='delete_book'),
]
