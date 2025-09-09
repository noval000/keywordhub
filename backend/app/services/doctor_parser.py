import asyncio
from pyppeteer import launch
from bs4 import BeautifulSoup
import logging
from typing import List, Dict, Optional, Any
import json
import random
import re
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import DoctorProfile, ParsingTask
from ..config import settings

logger = logging.getLogger(__name__)

class DoctorParser:
    def __init__(self):
        self.proxy_list = []
        self.browser = None
        self.current_proxy_index = 0
        self.current_proxy_auth = None  # Храним данные авторизации
        self.logger = logger  # Добавляем логгер как атрибут класса

        # Используем настройки из config
        self.max_retries = getattr(settings, 'PARSER_MAX_RETRIES', 10)
        self.request_timeout = getattr(settings, 'PARSER_REQUEST_TIMEOUT', 30) * 1000
        self.executable_path = getattr(settings, 'PUPPETEER_EXECUTABLE_PATH', None)
        self.headless = getattr(settings, 'PUPPETEER_HEADLESS', True)

        # Настройки для борьбы с капчей
        self.captcha_max_retries = 20
        self.captcha_delay = random.uniform(3, 7)

    def _normalize_proxy_for_chromium(self, proxy_string: str) -> Dict:
        """Нормализация прокси для Chromium с разделением данных авторизации"""
        proxy_string = proxy_string.strip()

        # Паттерны для разных форматов прокси
        patterns = [
            r'^([^:]+):([^@]+)@([^:]+):(\d+)$',  # user:pass@host:port
            r'^([^:]+):(\d+)$',  # host:port
            r'^(\d+\.\d+\.\d+\.\d+):(\d+)$'  # ip:port
        ]

        for i, pattern in enumerate(patterns):
            match = re.match(pattern, proxy_string)
            if match:
                if i == 0:  # user:pass@host:port
                    user, password, host, port = match.groups()
                    return {
                        'server': f"{host}:{port}",
                        'username': user,
                        'password': password,
                        'has_auth': True
                    }
                else:  # host:port или ip:port
                    if i == 1:
                        host, port = match.groups()
                    else:
                        host, port = match.groups()
                    return {
                        'server': f"{host}:{port}",
                        'username': None,
                        'password': None,
                        'has_auth': False
                    }

        logger.warning(f"Неизвестный формат прокси: {proxy_string}")
        return {
            'server': proxy_string,
            'username': None,
            'password': None,
            'has_auth': False
        }

    def set_proxy_list(self, proxy_strings: List[str]):
        """Установить список прокси с нормализацией для Chromium"""
        self.proxy_list = []
        for proxy in proxy_strings:
            if proxy.strip():
                normalized = self._normalize_proxy_for_chromium(proxy.strip())
                self.proxy_list.append(normalized)
                auth_info = f" (с авторизацией {normalized['username']})" if normalized['has_auth'] else " (без авторизации)"
                logger.info(f"Добавлен прокси: {normalized['server']}{auth_info}")

        logger.info(f"Загружено {len(self.proxy_list)} прокси серверов")

        # Перемешиваем список для случайного порядка
        random.shuffle(self.proxy_list)

    def get_next_proxy(self) -> Optional[Dict]:
        """Получить следующий прокси из списка (ОБЯЗАТЕЛЬНО)"""
        if not self.proxy_list:
            raise Exception("Нет доступных прокси! Парсинг невозможен без прокси.")

        proxy = self.proxy_list[self.current_proxy_index]
        self.current_proxy_index = (self.current_proxy_index + 1) % len(self.proxy_list)
        return proxy

    async def init_browser(self, proxy_data: Dict) -> bool:
        """Инициализация браузера ОБЯЗАТЕЛЬНО с прокси"""
        if not proxy_data:
            raise Exception("Прокси обязателен для работы парсера!")

        try:
            launch_options = {
                'headless': self.headless,
                'args': [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images',
                    f'--proxy-server={proxy_data["server"]}',  # Только сервер без авторизации
                ],
                'defaultViewport': {'width': 1366, 'height': 768},
                'ignoreHTTPSErrors': True,
                'timeout': self.request_timeout
            }

            # Добавляем executablePath только если он указан
            if self.executable_path:
                launch_options['executablePath'] = self.executable_path

            logger.info(f"Запуск браузера с прокси: {proxy_data['server']}")
            if proxy_data['has_auth']:
                logger.info(f"Будет использована авторизация: {proxy_data['username']}")

            self.browser = await launch(launch_options)

            # Сохраняем данные авторизации для использования в page.authenticate()
            self.current_proxy_auth = proxy_data if proxy_data['has_auth'] else None

            return True

        except Exception as e:
            logger.error(f"Ошибка инициализации браузера с прокси {proxy_data['server']}: {e}")
            return False

    async def create_authenticated_page(self):
        """Создание страницы с авторизацией прокси"""
        page = await self.browser.newPage()

        # Если есть авторизация прокси, устанавливаем её
        if self.current_proxy_auth and self.current_proxy_auth['has_auth']:
            try:
                await page.authenticate({
                    'username': self.current_proxy_auth['username'],
                    'password': self.current_proxy_auth['password']
                })
                logger.info(f"✅ Авторизация прокси установлена для пользователя: {self.current_proxy_auth['username']}")
            except Exception as e:
                logger.error(f"❌ Ошибка установки авторизации прокси: {e}")

        # Устанавливаем случайный User-Agent
        await page.setUserAgent(self._get_random_user_agent())

        # Устанавливаем заголовки
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })

        return page

    async def close_browser(self):
        """Безопасное закрытие браузера"""
        if self.browser:
            try:
                # Получаем все страницы и закрываем их
                pages = await self.browser.pages()
                for page in pages:
                    try:
                        await page.close()
                    except:
                        pass

                # Закрываем браузер
                await self.browser.close()

                # Даем время на корректное закрытие процесса
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.warning(f"Ошибка при закрытии браузера: {e}")
            finally:
                self.browser = None
                self.current_proxy_auth = None

    async def check_and_handle_captcha(self, page, url: str, current_proxy_data: Dict) -> tuple:
        """Проверка и обработка капчи с перебором прокси"""
        captcha_indicators = [
            '#checkbox-captcha-form',
            '.captcha',
            '[class*="captcha"]',
            '[id*="captcha"]',
            'form[action*="captcha"]',
            '.verify',
            '.verification',
            '.challenge',
            '.SmartCaptcha',
            '.YaCaptcha'
        ]

        attempt = 0
        while attempt < self.captcha_max_retries:
            try:
                # Проверяем наличие капчи
                captcha_found = False
                for selector in captcha_indicators:
                    captcha_element = await page.querySelector(selector)
                    if captcha_element:
                        captcha_found = True
                        logger.warning(f"🚫 Капча найдена ({selector}) на {url} с прокси {current_proxy_data['server']}")
                        break

                if not captcha_found:
                    logger.info(f"✅ Капчи нет, продолжаем парсинг")
                    return True, page

                # Если капча найдена - меняем прокси
                attempt += 1
                logger.info(f"🔄 Попытка {attempt}/{self.captcha_max_retries}: Смена прокси для обхода капчи")

                # Закрываем текущий браузер
                await self.close_browser()

                # Берем следующий прокси
                new_proxy_data = self.get_next_proxy()
                logger.info(f"🔀 Переключаемся на прокси: {new_proxy_data['server']}")

                # Инициализируем браузер с новым прокси
                if not await self.init_browser(new_proxy_data):
                    logger.error(f"❌ Не удалось запустить браузер с прокси {new_proxy_data['server']}")
                    continue

                # Создаем новую страницу с авторизацией
                page = await self.create_authenticated_page()

                # Задержка перед повторным переходом
                await asyncio.sleep(random.uniform(3, 8))

                # Переходим на страницу с новым прокси
                logger.info(f"🌐 Повторный переход на {url} с новым прокси {new_proxy_data['server']}")
                await page.goto(url, {
                    'waitUntil': 'networkidle2',
                    'timeout': self.request_timeout
                })

                # Ждем загрузки
                await asyncio.sleep(random.uniform(2, 5))

                # Обновляем текущий прокси
                current_proxy_data = new_proxy_data

            except Exception as e:
                logger.error(f"❌ Ошибка при обработке капчи: {e}")
                attempt += 1
                await asyncio.sleep(random.uniform(2, 5))

        logger.error(f"💀 Не удалось обойти капчу после {self.captcha_max_retries} попыток с разными прокси")
        return False, page

    async def parse_doctor_page(self, url: str, max_retries: Optional[int] = None) -> Dict:
        """Парсинг страницы ТОЛЬКО через прокси с активной борьбой с капчей"""
        if not self.proxy_list:
            return {
                'profile_url': url,
                'error': 'Нет доступных прокси для парсинга',
                'success': False
            }

        retries = max_retries or self.max_retries
        page = None

        for attempt in range(retries):
            # ВСЕГДА берем прокси (никогда без него)
            current_proxy_data = self.get_next_proxy()

            try:
                logger.info(f"🎯 Попытка {attempt + 1}/{retries}: Парсинг {url} через прокси {current_proxy_data['server']}")

                # Инициализируем браузер ОБЯЗАТЕЛЬНО с прокси
                if not await self.init_browser(current_proxy_data):
                    logger.error(f"❌ Не удалось запустить браузер с прокси {current_proxy_data['server']}")
                    continue

                # Создаем страницу с авторизацией
                page = await self.create_authenticated_page()

                # Переходим на страницу
                logger.info(f"🌐 Переход на: {url} через прокси {current_proxy_data['server']}")
                await page.goto(url, {
                    'waitUntil': 'networkidle2',
                    'timeout': self.request_timeout
                })

                # Ждем загрузки контента
                await asyncio.sleep(random.uniform(3, 6))

                # АКТИВНАЯ БОРЬБА С КАПЧЕЙ
                captcha_handled, page = await self.check_and_handle_captcha(page, url, current_proxy_data)
                if not captcha_handled:
                    logger.error(f"💀 Не удалось обойти капчу для {url}")
                    await self.close_browser()
                    continue

                # Парсим данные через page объект (НЕ HTML строку!)
                parsed_data = await self._parse_html_content(page, url)

                # Безопасно закрываем страницу и браузер
                try:
                    if page:
                        await page.close()
                except:
                    pass
                await self.close_browser()

                if parsed_data:
                    parsed_data['success'] = True
                    logger.info(f"✅ Успешно обработан: {url} через прокси {current_proxy_data['server']}")
                    return parsed_data
                else:
                    logger.warning(f"⚠️ Не удалось извлечь данные из {url}")
                    continue

            except Exception as e:
                error_msg = str(e)
                logger.error(f"❌ Ошибка парсинга {url} с прокси {current_proxy_data['server']} (попытка {attempt + 1}): {error_msg}")

                # Безопасно закрываем браузер при ошибке
                await self.close_browser()

                if attempt == retries - 1:
                    return {
                        'profile_url': url,
                        'error': f"Не удалось обработать после {retries} попыток с разными прокси: {error_msg}",
                        'success': False
                    }

                # Задержка перед следующей попыткой
                await asyncio.sleep(random.uniform(3, 8))

        return {
            'profile_url': url,
            'error': 'Максимальное количество попыток исчерпано',
            'success': False
        }

    async def _parse_html_content(self, page, url: str = None) -> Optional[Dict[str, Any]]:
        """Парсинг HTML контента страницы врача с Яндекса"""
        try:
            # Ожидаем загрузки основных элементов
            try:
                await page.waitForSelector('.CardHeader-Title, .OrganicTitle-Link', timeout=10000)
            except:
                # Если селекторы не найдены, продолжаем парсинг
                pass

            # Извлечение имени врача
            name = ""
            name_selectors = [
                '.CardHeader-Title',
                '.OrganicTitle-Link',
                '.DoctorCard-Name',
                'h1'
            ]

            for selector in name_selectors:
                try:
                    name_element = await page.querySelector(selector)
                    if name_element:
                        name = await page.evaluate('(element) => element.textContent', name_element)
                        name = name.strip() if name else ""
                        if name:
                            break
                except:
                    continue

            # Извлечение специализации и стажа из описания
            specialization = ""
            experience = ""

            description_selectors = [
                '.Description-Paragraph',
                '.DoctorCard-Specialization',
                '.OrganicText',
                '.Snippet'
            ]

            for selector in description_selectors:
                try:
                    elements = await page.querySelectorAll(selector)
                    for element in elements:
                        text = await page.evaluate('(element) => element.textContent', element)
                        if text:
                            text = text.strip()

                            # Поиск специализации (обычно первая строка описания)
                            if not specialization and any(word in text.lower() for word in
                                ['врач', 'доктор', 'специалист', 'терапевт', 'хирург', 'кардиолог',
                                 'невролог', 'офтальмолог', 'педиатр', 'гинеколог']):
                                specialization = text

                            # Поиск стажа работы
                            if 'стаж' in text.lower() or 'опыт' in text.lower():
                                experience = text
                except:
                    continue

            # Извлечение информации о клиниках/рабочих местах
            workplace = ""
            clinic_selectors = [
                '.UniSearchMedicineClinics',
                '.DoctorCard-Clinic',
                '.OrganicCard-Clinic',
                '.Clinic-Name'
            ]

            clinics = []
            for selector in clinic_selectors:
                try:
                    elements = await page.querySelectorAll(selector)
                    for element in elements:
                        clinic_text = await page.evaluate('(element) => element.textContent', element)
                        if clinic_text:
                            clinic_text = clinic_text.strip()
                            if clinic_text and clinic_text not in clinics:
                                clinics.append(clinic_text)
                except:
                    continue

            workplace = "; ".join(clinics) if clinics else ""

            # Извлечение рейтинга
            rating = ""
            rating_selectors = [
                '.ReviewAspectPercentageShort',
                '.Rating-Value',
                '.Stars-Value',
                '.DoctorCard-Rating'
            ]

            for selector in rating_selectors:
                try:
                    element = await page.querySelector(selector)
                    if element:
                        rating_text = await page.evaluate('(element) => element.textContent', element)
                        if rating_text:
                            rating = rating_text.strip()
                            # Извлекаем числовое значение рейтинга
                            rating_match = re.search(r'(\d+[.,]\d+|\d+)', rating)
                            if rating_match:
                                rating = rating_match.group(1).replace(',', '.')
                                break
                except:
                    continue

            # Извлечение количества отзывов
            reviews_count = ""
            reviews_selectors = [
                '.Reviews-Count',
                '.ReviewsCount',
                '.DoctorCard-ReviewsCount'
            ]

            for selector in reviews_selectors:
                try:
                    element = await page.querySelector(selector)
                    if element:
                        reviews_text = await page.evaluate('(element) => element.textContent', element)
                        if reviews_text:
                            reviews_match = re.search(r'(\d+)', reviews_text)
                            if reviews_match:
                                reviews_count = reviews_match.group(1)
                                break
                except:
                    continue

            # Извлечение телефонов
            phone = ""
            phone_selectors = [
                '.UniSearchMedicinePhone',
                '.DoctorCard-Phone',
                '.Phone-Number',
                'a[href^="tel:"]'
            ]

            phones = []
            for selector in phone_selectors:
                try:
                    elements = await page.querySelectorAll(selector)
                    for element in elements:
                        # Проверяем href для tel: ссылок
                        if selector == 'a[href^="tel:"]':
                            phone_href = await page.evaluate('(element) => element.href', element)
                            if phone_href:
                                phone_number = phone_href.replace('tel:', '').strip()
                                if phone_number and phone_number not in phones:
                                    phones.append(phone_number)
                        else:
                            phone_text = await page.evaluate('(element) => element.textContent', element)
                            if phone_text:
                                phone_text = phone_text.strip()
                                # Очищаем телефон от лишних символов, оставляем только цифры, +, -, (, )
                                clean_phone = re.sub(r'[^\d+\-\(\)\s]', '', phone_text)
                                if clean_phone and len(clean_phone) >= 10 and clean_phone not in phones:
                                    phones.append(clean_phone)
                except:
                    continue

            phone = "; ".join(phones) if phones else ""

            # Извлечение адресов
            address = ""
            address_selectors = [
                '.OrganicCard-Address',
                '.DoctorCard-Address',
                '.Clinic-Address',
                '.Address-Text'
            ]

            addresses = []
            for selector in address_selectors:
                try:
                    elements = await page.querySelectorAll(selector)
                    for element in elements:
                        address_text = await page.evaluate('(element) => element.textContent', element)
                        if address_text:
                            address_text = address_text.strip()
                            if address_text and address_text not in addresses:
                                addresses.append(address_text)
                except:
                    continue

            address = "; ".join(addresses) if addresses else ""

            # Извлечение образования (если доступно)
            education = ""
            education_selectors = [
                '.DoctorCard-Education',
                '.Education-Text',
                '.Doctor-Education'
            ]

            for selector in education_selectors:
                try:
                    element = await page.querySelector(selector)
                    if element:
                        education = await page.evaluate('(element) => element.textContent', element)
                        education = education.strip() if education else ""
                        if education:
                            break
                except:
                    continue

            # Получаем URL текущей страницы
            profile_url = url if url else page.url

            # Формируем результат
            doctor_data = {
                'name': name,
                'specialization': specialization,
                'experience': experience,
                'education': education,
                'workplace': workplace,
                'rating': rating,
                'reviews_count': reviews_count,
                'phone': phone,
                'address': address,
                'profile_url': profile_url
            }

            # Проверяем, что получили минимально необходимые данные
            if name or specialization:
                self.logger.info(f"Успешно извлечены данные врача: {name}")
                return doctor_data
            else:
                self.logger.warning("Не удалось извлечь основные данные врача (имя или специализацию)")
                return None

        except Exception as e:
            self.logger.error(f"Ошибка при парсинге HTML: {str(e)}")
            return None

    def _get_random_user_agent(self) -> str:
        """Получить случайный современный User-Agent"""
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
        ]
        return random.choice(user_agents)

    async def parse_urls_batch(self, urls: List[str], db: AsyncSession, task_uuid: str,
                              batch_size: int = 1, delay_between_requests: float = 5.0):
        """Пакетный парсинг ТОЛЬКО через прокси с правильной авторизацией"""

        if not self.proxy_list:
            logger.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Нет прокси! Парсинг невозможен.")
            return

        try:
            # Преобразуем task_uuid в UUID если это строка
            if isinstance(task_uuid, str):
                task_uuid = uuid.UUID(task_uuid)

            # Получаем задачу
            task_query = select(ParsingTask).where(ParsingTask.task_id == task_uuid)
            result = await db.execute(task_query)
            task = result.scalar_one_or_none()

            if not task:
                logger.error(f"Задача с task_id {task_uuid} не найдена")
                return

            # Обновляем статус задачи
            task.status = "running"
            await db.commit()
            await db.refresh(task)  # Обновляем объект из БД

            total_urls = len(urls)
            completed = 0
            successful = 0

            logger.info(f"🚀 Начинаем парсинг {total_urls} URL через {len(self.proxy_list)} прокси")

            # Обрабатываем каждый URL отдельно
            for i, url in enumerate(urls, 1):
                try:
                    logger.info(f"📋 Обработка {i}/{total_urls}: {url}")

                    # Парсим страницу
                    result = await self.parse_doctor_page(url)

                    # Создаем запись в БД
                    doctor_profile = DoctorProfile(
                        task_id=task_uuid,
                        name=result.get('name', ''),
                        specialization=result.get('specialization', ''),
                        experience=result.get('experience', ''),
                        education=result.get('education', ''),
                        workplace=result.get('workplace', ''),
                        rating=result.get('rating', ''),
                        reviews_count=result.get('reviews_count', ''),
                        phone=result.get('phone', ''),
                        address=result.get('address', ''),
                        profile_url=result.get('profile_url', url),
                        parsing_date=datetime.utcnow()
                    )

                    db.add(doctor_profile)
                    completed += 1

                    if result.get('success', False):
                        successful += 1
                        logger.info(f"✅ Успешно обработан врач: {result.get('name', 'Неизвестно')}")
                    else:
                        logger.warning(f"⚠️ Обработан с ошибкой: {result.get('error', 'Неизвестная ошибка')}")

                    # Обновляем прогресс в новой транзакции
                    try:
                        # Перезагружаем задачу из БД
                        fresh_task_query = select(ParsingTask).where(ParsingTask.task_id == task_uuid)
                        fresh_result = await db.execute(fresh_task_query)
                        fresh_task = fresh_result.scalar_one_or_none()

                        if fresh_task:
                            fresh_task.processed_profiles = completed
                            await db.commit()
                            logger.info(f"📊 Прогресс: {completed}/{total_urls} ({successful} успешных)")
                        else:
                            logger.warning(f"Не удалось найти задачу для обновления прогресса")

                    except Exception as progress_error:
                        logger.error(f"Ошибка обновления прогресса: {progress_error}")
                        await db.rollback()

                    # Задержка между врачами
                    if completed < total_urls:
                        delay = random.uniform(delay_between_requests, delay_between_requests + 3)
                        logger.info(f"⏳ Задержка {delay:.1f}с перед следующим врачом")
                        await asyncio.sleep(delay)

                except Exception as e:
                    logger.error(f"❌ Критическая ошибка обработки {url}: {e}")

                    # Создаем запись с ошибкой
                    try:
                        doctor_profile = DoctorProfile(
                            task_id=task_uuid,
                            name="Критическая ошибка парсинга",
                            profile_url=url,
                            parsing_date=datetime.utcnow()
                        )

                        db.add(doctor_profile)
                        completed += 1
                        await db.commit()
                    except Exception as db_error:
                        logger.error(f"Ошибка сохранения профиля с ошибкой: {db_error}")
                        await db.rollback()

            # Завершаем задачу
            try:
                final_task_query = select(ParsingTask).where(ParsingTask.task_id == task_uuid)
                final_result = await db.execute(final_task_query)
                final_task = final_result.scalar_one_or_none()

                if final_task:
                    final_task.status = "completed"
                    final_task.completed_at = datetime.utcnow()
                    final_task.processed_profiles = completed
                    await db.commit()

                    logger.info(f"🎉 Парсинг завершен! Обработано: {completed}/{total_urls}, Успешных: {successful}")
                else:
                    logger.error(f"Не удалось найти задачу для финального обновления")

            except Exception as final_error:
                logger.error(f"Ошибка финального обновления задачи: {final_error}")
                await db.rollback()

        except Exception as e:
            logger.error(f"💀 Критическая ошибка при пакетном парсинге: {e}")

            try:
                # Обновляем статус на ошибку
                error_task_query = select(ParsingTask).where(ParsingTask.task_id == task_uuid)
                error_result = await db.execute(error_task_query)
                error_task = error_result.scalar_one_or_none()

                if error_task:
                    error_task.status = "failed"
                    error_task.error_message = str(e)
                    error_task.completed_at = datetime.utcnow()
                    await db.commit()
            except Exception as error_update_error:
                logger.error(f"Ошибка обновления статуса ошибки: {error_update_error}")
                await db.rollback()

    async def save_profile_to_db(self, profile_data: dict, task_uuid: str, db: AsyncSession):
        """Сохранение профиля с привязкой к task_id"""
        try:
            # Преобразуем task_uuid в UUID если это строка
            if isinstance(task_uuid, str):
                task_uuid = uuid.UUID(task_uuid)

            doctor_profile = DoctorProfile(
                task_id=task_uuid,
                name=profile_data.get('name', ''),
                specialization=profile_data.get('specialization', ''),
                experience=profile_data.get('experience', ''),
                education=profile_data.get('education', ''),
                workplace=profile_data.get('workplace', ''),
                rating=profile_data.get('rating', ''),
                reviews_count=profile_data.get('reviews_count', ''),
                phone=profile_data.get('phone', ''),
                address=profile_data.get('address', ''),
                profile_url=profile_data.get('profile_url', ''),
                parsing_date=datetime.utcnow()
            )

            db.add(doctor_profile)
            await db.commit()
            return doctor_profile

        except Exception as e:
            logger.error(f"Ошибка сохранения профиля: {e}")
            await db.rollback()
            raise