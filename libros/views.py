import io
import requests
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db import IntegrityError
from django.http import HttpResponse
from openpyxl import Workbook

from .models import Book
from .forms import ISBNForm, ManualBookForm

OPENLIBRARY_URL = "https://openlibrary.org/api/books"
GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
LIBRETRANSLATE_URL = "https://libretranslate.de/translate"


def index(request):
	isbn_form = ISBNForm()
	manual_form = ManualBookForm()
	return render(request, 'libros/index.html', {'isbn_form': isbn_form, 'manual_form': manual_form})


def fetch_book_data(isbn):
	try:
		params = {'bibkeys': f'ISBN:{isbn}', 'format': 'json', 'jscmd': 'data'}
		resp = requests.get(OPENLIBRARY_URL, params=params, timeout=10)
		if resp.status_code != 200:
			return None
		data = resp.json()
		key = f'ISBN:{isbn}'
		if key not in data:
			# Si Open Library no devuelve datos, intentar Google Books como fallback
			try:
				gparams = {'q': f'isbn:{isbn}'}
				gresp = requests.get(GOOGLE_BOOKS_URL, params=gparams, timeout=10)
				if gresp.status_code == 200:
					gdata = gresp.json()
					items = gdata.get('items')
					if items:
						info = items[0].get('volumeInfo', {})
						title = info.get('title', '')
						authors = ', '.join(info.get('authors', []))
						published_date = info.get('publishedDate', '')
						number_of_pages = info.get('pageCount')
						cover = ''
						image_links = info.get('imageLinks', {})
						cover = image_links.get('thumbnail') or image_links.get('smallThumbnail') or ''
						# Intentar traducir título al español si la API de traducción responde
						def translate_to_spanish(text):
							if not text:
								return text
							try:
								# LibreTranslate (detecta idioma automáticamente)
								resp = requests.post(LIBRETRANSLATE_URL, json={'q': text, 'source': 'auto', 'target': 'es', 'format': 'text'}, timeout=8)
								if resp.status_code == 200:
									data = resp.json()
									translated = data.get('translatedText')
									if translated:
										return translated
							except requests.RequestException:
								pass
							try:
								# Fallback a MyMemory (menos fiable pero útil)
								mresp = requests.get('https://api.mymemory.translated.net/get', params={'q': text, 'langpair': 'en|es'}, timeout=8)
								if mresp.status_code == 200:
									mdata = mresp.json()
									translated = mdata.get('responseData', {}).get('translatedText')
									if translated:
										return translated
							except requests.RequestException:
								pass
							return text

						# traduzca y use la versión traducida si difiere
						translated_title = translate_to_spanish(title)
						if translated_title and translated_title.strip() and translated_title.strip().lower() != title.strip().lower():
							title = translated_title

						return {
							'title': title,
							'authors': authors,
							'published_date': published_date,
							'number_of_pages': number_of_pages,
							'cover_url': cover
						}
			except requests.RequestException:
				return None
			return None
		info = data[key]
		title = info.get('title', '')
		authors = ', '.join(a.get('name', '') for a in info.get('authors', []))
		published_date = info.get('publish_date', '')
		number_of_pages = info.get('number_of_pages')
		cover = ''
		if 'cover' in info:
			cover = info['cover'].get('large') or info['cover'].get('medium') or info['cover'].get('small') or ''
		return {
			'title': title,
			'authors': authors,
			'published_date': published_date,
			'number_of_pages': number_of_pages,
			'cover_url': cover
		}
	except requests.RequestException:
		return None


def add_by_isbn(request):
	if request.method == 'POST':
		form = ISBNForm(request.POST)
		if form.is_valid():
			isbn = form.cleaned_data['isbn'].replace('-', '').strip()
			if len(isbn) not in (10, 13):
				messages.error(request, 'ISBN inválido (debe tener 10 o 13 dígitos).')
				return redirect('libros:index')
			book_data = fetch_book_data(isbn)
			if not book_data:
				messages.error(request, 'No se encontró información para ese ISBN.')
				return redirect('libros:index')
			try:
				book = Book.objects.create(
					title=book_data.get('title', '(Sin título)'),
					authors=book_data.get('authors', ''),
					isbn=isbn,
					published_date=book_data.get('published_date', ''),
					number_of_pages=book_data.get('number_of_pages'),
					cover_url=book_data.get('cover_url', ''),
				)
				messages.success(request, f'Libro "{book.title}" agregado correctamente.')
				return redirect('libros:list_books')
			except IntegrityError:
				messages.warning(request, 'Este libro ya existe en tu colección.')
				return redirect('libros:list_books')
	messages.error(request, 'Petición inválida.')
	return redirect('libros:index')


def add_manual(request):
	if request.method == 'POST':
		form = ManualBookForm(request.POST)
		if form.is_valid():
			try:
				form.save()
				messages.success(request, 'Libro agregado manualmente.')
				return redirect('libros:list_books')
			except IntegrityError:
				messages.warning(request, 'Este ISBN ya existe en la colección.')
				return redirect('libros:list_books')
	messages.error(request, 'Datos inválidos.')
	return redirect('libros:index')


def list_books(request):
	sort = request.GET.get('sort')
	direction = request.GET.get('dir', 'asc')
	qs = Book.objects.all()
	if sort in ('authors', 'genre'):
		order_field = sort if direction == 'asc' else f'-{sort}'
		qs = qs.order_by(order_field)
	else:
		qs = qs.order_by('-created_at')

	# Prepare simple variables for template to avoid complex template conditionals
	next_dir_authors = 'desc' if sort == 'authors' and direction == 'asc' else 'asc'
	next_dir_genre = 'desc' if sort == 'genre' and direction == 'asc' else 'asc'
	arrow_authors = '▲' if sort == 'authors' and direction == 'asc' else ('▼' if sort == 'authors' and direction == 'desc' else '')
	arrow_genre = '▲' if sort == 'genre' and direction == 'asc' else ('▼' if sort == 'genre' and direction == 'desc' else '')

	ctx = {
		'books': qs,
		'current_sort': sort,
		'current_dir': direction,
		'next_dir_authors': next_dir_authors,
		'next_dir_genre': next_dir_genre,
		'arrow_authors': arrow_authors,
		'arrow_genre': arrow_genre,
	}
	return render(request, 'libros/list.html', ctx)


def export_excel(request):
	books = Book.objects.all().order_by('title')
	wb = Workbook()
	ws = wb.active
	ws.title = "Mi Biblioteca"

	headers = ['Título', 'Autores', 'Género', 'ISBN', 'Fecha de publicación', 'Páginas', 'URL portada', 'Registrado']
	ws.append(headers)

	for b in books:
		ws.append([
			b.title,
			b.authors,
			getattr(b, 'genre', ''),
			b.isbn,
			b.published_date,
			b.number_of_pages or '',
			b.cover_url,
			b.created_at.strftime('%Y-%m-%d %H:%M:%S')
		])

	stream = io.BytesIO()
	wb.save(stream)
	stream.seek(0)
	response = HttpResponse(stream.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
	response['Content-Disposition'] = 'attachment; filename="mi_biblioteca.xlsx"'
	return response


def delete_book(request, pk):
	if request.method == 'POST':
		book = get_object_or_404(Book, pk=pk)
		title = book.title
		book.delete()
		messages.success(request, f'Libro "{title}" eliminado correctamente.')
		return redirect('libros:list_books')
	messages.error(request, 'Solicitud inválida para eliminar el libro.')
	return redirect('libros:list_books')
