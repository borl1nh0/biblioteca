from django.contrib import admin
from .models import Book


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
	list_display = ('title', 'authors', 'genre', 'isbn', 'published_date', 'number_of_pages', 'created_at')
	search_fields = ('title', 'authors', 'isbn', 'genre')
