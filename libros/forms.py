from django import forms
from .models import Book


class ISBNForm(forms.Form):
    isbn = forms.CharField(max_length=20, label='ISBN', required=True,
                           widget=forms.TextInput(attrs={'placeholder': 'Escanea o escribe ISBN', 'class': 'form-control'}))


class ManualBookForm(forms.ModelForm):
    class Meta:
        model = Book
        fields = ['title', 'authors', 'genre', 'isbn', 'published_date', 'number_of_pages', 'cover_url']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'authors': forms.TextInput(attrs={'class': 'form-control'}),
            'genre': forms.TextInput(attrs={'class': 'form-control'}),
            'isbn': forms.TextInput(attrs={'class': 'form-control'}),
            'published_date': forms.TextInput(attrs={'class': 'form-control'}),
            'number_of_pages': forms.NumberInput(attrs={'class': 'form-control'}),
            'cover_url': forms.URLInput(attrs={'class': 'form-control'}),
        }
