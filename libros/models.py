from django.db import models


class Book(models.Model):
	title = models.CharField(max_length=500)
	authors = models.CharField(max_length=500, blank=True)
	genre = models.CharField(max_length=100, blank=True)
	isbn = models.CharField(max_length=20, unique=True)
	published_date = models.CharField(max_length=100, blank=True)
	number_of_pages = models.PositiveIntegerField(null=True, blank=True)
	cover_url = models.URLField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"{self.title} ({self.isbn})"
